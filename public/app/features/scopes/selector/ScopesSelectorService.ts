import { Scope, ScopeNode, store as storeImpl } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneRenderProfiler } from '@grafana/scenes';
import { getDashboardSceneProfiler } from 'app/features/dashboard/services/DashboardProfiler';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';
import { isCurrentPath } from '../dashboards/scopeNavgiationUtils';

import {
  closeNodes,
  expandNodes,
  getPathOfNode,
  insertPathNodesIntoTree,
  isNodeExpandable,
  isNodeSelectable,
  modifyTreeNodeAtPath,
  treeNodeAtPath,
} from './scopesTreeUtils';
import { NodesMap, RecentScope, RecentScopeSchema, ScopeSchema, ScopesMap, SelectedScope, TreeNode } from './types';
export const RECENT_SCOPES_KEY = 'grafana.scopes.recent';

export interface ScopesSelectorServiceState {
  // Used to indicate loading of the scopes themselves for example when applying them.
  loading: boolean;

  // Indicates loading children of a specific scope node.
  loadingNodeName: string | undefined;

  // Whether the scopes selector drawer is opened
  opened: boolean;

  // A cache for a specific scope objects that come from the API. nodes being objects in the categories tree and scopes
  // the actual scope definitions. They are not guaranteed to be there! For example we may have a scope applied from
  // url for which we don't have a node, or scope is still loading after it is selected in the UI. This means any
  // access needs to be guarded and not automatically assumed it will return an object.
  nodes: NodesMap;
  scopes: ScopesMap;

  // Scopes that are selected and applied.
  appliedScopes: SelectedScope[];

  // Scopes that are selected but not applied yet.
  selectedScopes: SelectedScope[];

  // Simple tree structure for the scopes categories. Each node in a tree has a scopeNodeId which keys the nodes cache
  // map.
  tree: TreeNode | undefined;
}

export class ScopesSelectorService extends ScopesServiceBase<ScopesSelectorServiceState> {
  constructor(
    private apiClient: ScopesApiClient,
    private dashboardsService: ScopesDashboardsService,
    private store = storeImpl,
    private interactionProfiler: SceneRenderProfiler | undefined = config.dashboardPerformanceMetrics.length
      ? getDashboardSceneProfiler()
      : undefined
  ) {
    super({
      loading: false,
      opened: false,
      loadingNodeName: undefined,

      nodes: {},
      scopes: {},

      selectedScopes: [],
      appliedScopes: [],

      tree: {
        expanded: false,
        scopeNodeId: '', // root
        query: '',
        children: undefined,
      },
    });

    // Load nodes from recent scopes so they are readily available
    const parentNodes = this.getNodesFromRecentScopes();
    this.updateState({ nodes: { ...this.state.nodes, ...parentNodes } });
  }

  // Loads a node from the API and adds it to the nodes cache
  public getScopeNode = async (scopeNodeId: string) => {
    if (this.state.nodes[scopeNodeId]) {
      return this.state.nodes[scopeNodeId];
    }

    try {
      const node = await this.apiClient.fetchScopeNode(scopeNodeId);
      if (node) {
        this.updateState({ nodes: { ...this.state.nodes, [node.metadata.name]: node } });
      }
      return node;
    } catch (error) {
      console.error('Failed to load node', error);
      return undefined;
    }
  };

  private getNodePath = async (scopeNodeId: string): Promise<ScopeNode[]> => {
    const node = await this.getScopeNode(scopeNodeId);
    if (!node) {
      return [];
    }
    const parentPath =
      node.spec.parentName && node.spec.parentName !== '' ? await this.getNodePath(node.spec.parentName) : [];

    return [...parentPath, node];
  };

  public resolvePathToRoot = async (
    scopeNodeId: string,
    tree: TreeNode
  ): Promise<{ path: ScopeNode[]; tree: TreeNode }> => {
    if (!tree) {
      throw new Error('Tree is required');
    }
    const nodePath = await this.getNodePath(scopeNodeId);
    const newTree = insertPathNodesIntoTree(tree, nodePath);

    this.updateState({ tree: newTree });

    return { path: nodePath, tree: newTree };
  };

  // Resets query and toggles expanded state of a node
  public toggleExpandedNode = async (scopeNodeId: string) => {
    const path = getPathOfNode(scopeNodeId, this.state.nodes);
    const nodeToToggle = treeNodeAtPath(this.state.tree!, path);

    if (!nodeToToggle) {
      throw new Error(`Node ${scopeNodeId} not found in tree`);
    }

    if (nodeToToggle.scopeNodeId !== '' && !isNodeExpandable(this.state.nodes[nodeToToggle.scopeNodeId])) {
      throw new Error(`Trying to expand node at id ${scopeNodeId} that is not expandable`);
    }

    const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
      treeNode.expanded = !nodeToToggle.expanded;
      treeNode.query = '';
    });

    this.updateState({ tree: newTree });
    // If we are collapsing, we need to make sure that all the parent's children are avilable
    if (nodeToToggle.expanded === true) {
      const parentPath = path.slice(0, -1);
      const parentNode = treeNodeAtPath(this.state.tree!, parentPath);
      if (parentNode) {
        await this.loadNodeChildren(parentPath, parentNode, parentNode.query);
      }
    } else {
      await this.loadNodeChildren(path, nodeToToggle);
    }
  };

  public filterNode = async (scopeNodeId: string, query: string) => {
    const path = getPathOfNode(scopeNodeId, this.state.nodes);
    const nodeToFilter = treeNodeAtPath(this.state.tree!, path);

    if (!nodeToFilter) {
      throw new Error(`Trying to filter node at path or id ${scopeNodeId} not found`);
    }

    if (nodeToFilter.scopeNodeId !== '' && !isNodeExpandable(this.state.nodes[nodeToFilter.scopeNodeId])) {
      throw new Error(`Trying to filter node at id ${scopeNodeId} that is not expandable`);
    }

    const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
      treeNode.expanded = true;
      treeNode.query = query;
    });
    this.updateState({ tree: newTree });

    await this.loadNodeChildren(path, nodeToFilter, query);
  };

  private expandOrFilterNode = async (scopeNodeId: string, query?: string) => {
    this.interactionProfiler?.startInteraction('scopeNodeDiscovery');

    const path = getPathOfNode(scopeNodeId, this.state.nodes);

    const nodeToExpand = treeNodeAtPath(this.state.tree!, path);

    try {
      if (!nodeToExpand) {
        throw new Error(`Node ${scopeNodeId} not found in tree`);
      }

      if (nodeToExpand.scopeNodeId !== '' && !isNodeExpandable(this.state.nodes[nodeToExpand.scopeNodeId])) {
        throw new Error(`Trying to expand node at id ${scopeNodeId} that is not expandable`);
      }

      if (!nodeToExpand.expanded || nodeToExpand.query !== query) {
        const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
          treeNode.expanded = true;
          treeNode.query = query || '';
        });
        this.updateState({ tree: newTree });

        await this.loadNodeChildren(path, nodeToExpand, query);
      }
    } catch (error) {
      throw error;
    } finally {
      this.interactionProfiler?.stopInteraction();
    }
  };

  private collapseNode = async (scopeNodeId: string) => {
    const path = getPathOfNode(scopeNodeId, this.state.nodes);

    const nodeToCollapse = treeNodeAtPath(this.state.tree!, path);

    if (!nodeToCollapse) {
      throw new Error(`Trying to collapse node at path or id ${scopeNodeId} not found`);
    }

    const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
      treeNode.expanded = false;
      treeNode.query = '';
    });
    this.updateState({ tree: newTree });
  };

  private loadNodeChildren = async (path: string[], treeNode: TreeNode, query?: string) => {
    this.updateState({ loadingNodeName: treeNode.scopeNodeId });

    const childNodes = await this.apiClient.fetchNodes({ parent: treeNode.scopeNodeId, query });

    const newNodes = { ...this.state.nodes };

    for (const node of childNodes) {
      newNodes[node.metadata.name] = node;
    }

    const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
      // Set parent query only when filtering within existing children
      treeNode.children = {};
      for (const node of childNodes) {
        treeNode.children[node.metadata.name] = {
          expanded: false,
          scopeNodeId: node.metadata.name,
          // Only set query on tree nodes if parent already has children (filtering vs first expansion). This is used for saerch highlighting.
          query: query || '',
          children: undefined,
        };
      }
    });

    // TODO: we might not want to update the tree as a side effect of this function
    this.updateState({ tree: newTree, nodes: newNodes, loadingNodeName: undefined });
    return { newTree };
  };

  /**
   * Selecting a scope means we add it to a temporary list of scopes that are waiting to be applied. We make sure
   * that the selection makes sense (like not allowing selection from multiple categories) and prefetch the scope.
   * @param scopeNodeId
   */
  public selectScope = async (scopeNodeId: string) => {
    let scopeNode = this.state.nodes[scopeNodeId];

    if (!isNodeSelectable(scopeNode)) {
      throw new Error(`Trying to select node with id ${scopeNodeId} that is not selectable`);
    }

    if (!scopeNode.spec.linkId) {
      throw new Error(`Trying to select node id ${scopeNodeId} that does not have a linkId`);
    }

    // We prefetch the scope metadata to make sure we have it cached before we apply the scope.
    this.apiClient.fetchScope(scopeNode.spec.linkId).then((scope) => {
      // We don't need to wait for the update here, so we can use then instead of await.
      if (scope) {
        this.updateState({ scopes: { ...this.state.scopes, [scope.metadata.name]: scope } });
      }
    });

    // TODO: if we do global search we may not have a parent node loaded. We have the ID but there is not an API that
    //   would allow us to load scopeNode by ID right now so this can be undefined which means we skip the
    //   disableMultiSelect check.
    const parentNode = this.state.nodes[scopeNode.spec.parentName!];
    const selectedScope = {
      scopeId: scopeNode.spec.linkId,
      scopeNodeId: scopeNode.metadata.name,
      parentNodeId: parentNode?.metadata.name,
    };

    // if something is selected we look at parent and see if we are selecting in the same category or not. As we
    // cannot select in multiple categories we only need to check the first selected node. It is possible we have
    // something selected without knowing the parent so we default to assuming it's not the same parent.
    const sameParent =
      this.state.selectedScopes[0]?.scopeNodeId &&
      this.state.nodes[this.state.selectedScopes[0].scopeNodeId].spec.parentName === scopeNode.spec.parentName;

    if (
      !sameParent ||
      // Parent says we can only select one scope at a time.
      parentNode?.spec.disableMultiSelect ||
      // If nothing is selected yet we just add this one.
      this.state.selectedScopes.length === 0
    ) {
      this.updateState({ selectedScopes: [selectedScope] });
    } else {
      this.updateState({ selectedScopes: [...this.state.selectedScopes, selectedScope] });
    }
  };

  /**
   * Deselect a selected scope.
   * @param scopeIdOrScopeNodeId This can be either a scopeId or a scopeNodeId.
   */
  public deselectScope = async (scopeIdOrScopeNodeId: string) => {
    const node = this.state.nodes[scopeIdOrScopeNodeId];

    // This is a bit complicated because there are multiple cases where we can deselect a scope without having enough
    // information.
    const filter: (s: SelectedScope) => boolean = node
      ? // This case is when we get scopeNodeId but the selected scope can have one or the other. This happens on reload
        // when we have just scopeId from the URL but then we navigate to the node in a tree and try to deselect the node.
        (s) => s.scopeNodeId !== node.metadata.name && s.scopeId !== node.spec.linkId
      : // This is when we scopeId, or scopeNodeId and the nodes aren't loaded yet. So we just try to match the id to the
        // scopes.
        (s) => s.scopeNodeId !== scopeIdOrScopeNodeId && s.scopeId !== scopeIdOrScopeNodeId;

    let newSelectedScopes = this.state.selectedScopes.filter(filter);
    this.updateState({ selectedScopes: newSelectedScopes });
  };

  // TODO: Replace all usage of this function with expandNode and filterNode.
  // @deprecated
  public updateNode = async (scopeNodeId: string, expanded: boolean, query: string) => {
    if (expanded) {
      return this.expandOrFilterNode(scopeNodeId, query);
    }
    return this.collapseNode(scopeNodeId);
  };

  changeScopes = (scopeNames: string[], parentNodeId?: string) => {
    return this.applyScopes(scopeNames.map((id) => ({ scopeId: id, parentNodeId })));
  };

  /**
   * Apply the selected scopes. Apart from setting the scopes it also fetches the scope metadata and also loads the
   * related dashboards.
   */
  private applyScopes = async (scopes: SelectedScope[]) => {
    // Skip if we are trying to apply the same scopes as are already applied.
    if (
      this.state.appliedScopes.length === scopes.length &&
      this.state.appliedScopes.every((selectedScope) => scopes.find((s) => selectedScope.scopeId === s.scopeId))
    ) {
      return;
    }

    // Apply the scopes right away even though we don't have the metadata yet.
    this.updateState({ appliedScopes: scopes, selectedScopes: scopes, loading: scopes.length > 0 });

    // Fetches both dashboards and scope navigations
    // We call this even if we have 0 scope because in that case it also closes the dashboard drawer.
    this.dashboardsService.fetchDashboards(scopes.map((s) => s.scopeId)).then(() => {
      const selectedScopeNode = scopes[0]?.scopeNodeId ? this.state.nodes[scopes[0]?.scopeNodeId] : undefined;
      this.redirectAfterApply(selectedScopeNode);
    });

    if (scopes.length > 0) {
      const fetchedScopes = await this.apiClient.fetchMultipleScopes(scopes.map((s) => s.scopeId));
      const newScopesState = { ...this.state.scopes };
      for (const scope of fetchedScopes) {
        newScopesState[scope.metadata.name] = scope;
      }

      const scopeNode = scopes[0]?.scopeNodeId ? this.state.nodes[scopes[0]?.scopeNodeId] : undefined;

      // If parentNodeId is provided, use it directly as the parent node
      // If not provided, try to get the parent from the scope node
      // When selected from recent scopes, we don't have access to the scope node (if it hasn't been loaded), but we do have access to the parent node from local storage.
      const parentNodeId = scopes[0]?.parentNodeId || scopeNode?.spec.parentName;
      const parentNode = parentNodeId ? this.state.nodes[parentNodeId] : undefined;

      this.addRecentScopes(fetchedScopes, parentNode);
      this.updateState({ scopes: newScopesState, loading: false });
    }
  };

  // Redirect to the scope node's redirect URL if it exists, otherwise redirect to the first scope navigation.
  private redirectAfterApply = (scopeNode: ScopeNode | undefined) => {
    // Check if the selected scope has a redirect URL
    if (scopeNode && scopeNode.spec.redirectUrl && typeof scopeNode.spec.redirectUrl === 'string') {
      locationService.push(scopeNode.spec.redirectUrl);
      return;
    }

    // Redirect to first scopeNavigation if current URL isn't a scopeNavigation
    const currentPath = locationService.getLocation().pathname;
    const activeScopeNavigation = this.dashboardsService.state.scopeNavigations.find((s) => {
      if (!('url' in s.spec) || typeof s.spec.url !== 'string') {
        return false;
      }
      return isCurrentPath(currentPath, s.spec.url);
    });

    if (!activeScopeNavigation && this.dashboardsService.state.scopeNavigations.length > 0) {
      // Redirect to the first available scopeNavigation
      const firstScopeNavigation = this.dashboardsService.state.scopeNavigations[0];

      if (
        firstScopeNavigation &&
        'url' in firstScopeNavigation.spec &&
        typeof firstScopeNavigation.spec.url === 'string' &&
        // Only redirect to dashboards TODO: Remove this once Logs Drilldown has Scopes support
        firstScopeNavigation.spec.url.includes('/d/')
      ) {
        locationService.push(firstScopeNavigation.spec.url);
      }
    }
  };

  public removeAllScopes = () => this.applyScopes([]);

  private addRecentScopes = (scopes: Scope[], parentNode?: ScopeNode) => {
    if (scopes.length === 0) {
      return;
    }

    const newScopes: RecentScope[] = structuredClone(scopes);
    // Set parent node for the first scope. We don't currently support multiple parent nodes being displayed, hence we only add for the first one
    if (parentNode) {
      newScopes[0].parentNode = parentNode;
    }

    const RECENT_SCOPES_MAX_LENGTH = 5;

    const recentScopes = this.getRecentScopes();
    recentScopes.unshift(newScopes);
    this.store.set(RECENT_SCOPES_KEY, JSON.stringify(recentScopes.slice(0, RECENT_SCOPES_MAX_LENGTH - 1)));
  };

  /**
   * Returns recent scopes from local storage. It is array of array cause each item can represent application of
   * multiple different scopes.
   */
  public getRecentScopes = (): RecentScope[][] => {
    const content: string | undefined = this.store.get(RECENT_SCOPES_KEY);
    const recentScopes = parseScopesFromLocalStorage(content);

    // Filter out the current selection from recent scopes to avoid duplicates
    return recentScopes.filter((scopes: RecentScope[]) => {
      if (scopes.length !== this.state.appliedScopes.length) {
        return true;
      }
      const scopeSet = new Set(scopes.map((s) => s.metadata.name));
      return !this.state.appliedScopes.every((s) => scopeSet.has(s.scopeId));
    });
  };

  private getNodesFromRecentScopes = (): Record<string, ScopeNode> => {
    const content: string | undefined = this.store.get(RECENT_SCOPES_KEY);
    const recentScopes = parseScopesFromLocalStorage(content);

    // Load parent nodes for recent scopes
    const parentNodes = Object.fromEntries(
      recentScopes
        .map((scopes) => [scopes[0]?.parentNode?.metadata?.name, scopes[0]?.parentNode])
        .filter(([key, parentNode]) => parentNode !== undefined && key !== undefined)
    );

    return parentNodes;
  };

  /**
   * Opens the scopes selector drawer and loads the root nodes if they are not loaded yet.
   */
  public open = async () => {
    if (!this.state.tree?.children || Object.keys(this.state.tree?.children).length === 0) {
      await this.expandOrFilterNode('');
    }

    // First close all nodes
    let newTree = closeNodes(this.state.tree!);

    if (this.state.selectedScopes.length && this.state.selectedScopes[0].parentNodeId) {
      let path = getPathOfNode(this.state.selectedScopes[0].parentNodeId, this.state.nodes);

      // Get node at path, and request it's children if they don't exist yet
      let nodeAtPath = treeNodeAtPath(newTree, path);

      // In the cases where nodes are not in the tree yet
      if (!nodeAtPath) {
        try {
          newTree = (await this.resolvePathToRoot(this.state.selectedScopes[0].parentNodeId, newTree)).tree;
          nodeAtPath = treeNodeAtPath(newTree, path);
        } catch (error) {
          console.error('Failed to resolve path to root', error);
        }
      }

      if (nodeAtPath && !nodeAtPath.children) {
        // This will update the tree with the children
        const { newTree: newTreeWithChildren } = await this.loadNodeChildren(path, nodeAtPath, '');
        newTree = newTreeWithChildren;
      }

      // Expand the nodes to the selected scope - must be done after loading children
      try {
        newTree = expandNodes(newTree, path);
      } catch (error) {
        console.error('Failed to expand nodes', error);
      }
    }

    this.resetSelection();
    this.updateState({ tree: newTree, opened: true });
  };

  public closeAndReset = () => {
    this.updateState({ opened: false });
    this.resetSelection();
  };

  public closeAndApply = () => {
    this.updateState({ opened: false });
    return this.apply();
  };

  public apply = () => {
    return this.applyScopes(this.state.selectedScopes);
  };

  public resetSelection = () => {
    this.updateState({ selectedScopes: [...this.state.appliedScopes] });
  };

  public searchAllNodes = async (query: string, limit: number) => {
    const scopeNodes = await this.apiClient.fetchNodes({ query, limit });
    const newNodes = { ...this.state.nodes };
    for (const node of scopeNodes) {
      newNodes[node.metadata.name] = node;
    }
    this.updateState({ nodes: newNodes });
    return scopeNodes;
  };

  public getScopeNodes = async (scopeNodeNames: string[]): Promise<ScopeNode[]> => {
    const nodesMap: NodesMap = {};
    // Get nodes that are already in the cache
    for (const name of scopeNodeNames) {
      if (this.state.nodes[name]) {
        nodesMap[name] = this.state.nodes[name];
      }
    }

    // Get nodes that are not in the cache
    const nodesToFetch = scopeNodeNames.filter((name) => !nodesMap[name]);

    const nodes = await this.apiClient.fetchMultipleScopeNodes(nodesToFetch);
    for (const node of nodes) {
      nodesMap[node.metadata.name] = node;
    }

    const newNodes = { ...this.state.nodes, ...nodesMap };

    // Return both caches and fetches nodes in the correct order
    this.updateState({ nodes: newNodes });
    return scopeNodeNames.map((name) => nodesMap[name]).filter((node) => node !== undefined);
  };
}

function isScopeLocalStorageV1(obj: unknown): obj is { scope: Scope } {
  return typeof obj === 'object' && obj !== null && 'scope' in obj && isScopeObj(obj['scope']);
}

function isScopeObj(obj: unknown): obj is Scope {
  return ScopeSchema.safeParse(obj).success;
}

function hasValidScopeParentNode(obj: unknown): obj is RecentScope {
  return RecentScopeSchema.safeParse(obj).success;
}

function parseScopesFromLocalStorage(content: string | undefined): RecentScope[][] {
  let recentScopes;
  try {
    recentScopes = JSON.parse(content || '[]');
  } catch (e) {
    console.error('Failed to parse recent scopes', e, content);
    return [];
  }
  if (!(Array.isArray(recentScopes) && Array.isArray(recentScopes[0]))) {
    return [];
  }

  if (isScopeLocalStorageV1(recentScopes[0]?.[0])) {
    // Backward compatibility
    recentScopes = recentScopes.map((s: Array<{ scope: Scope }>) => s.map((scope) => scope.scope));
  } else if (!isScopeObj(recentScopes[0]?.[0])) {
    return [];
  }

  // Verify the structure of the parent node for all recent scope sets, and remove it if it is not valid
  for (const scopeSet of recentScopes) {
    if (scopeSet[0]?.parentNode) {
      if (!hasValidScopeParentNode(scopeSet[0])) {
        scopeSet[0].parentNode = undefined;
      }
    }
  }

  return recentScopes;
}
