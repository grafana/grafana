import { Scope } from '@grafana/data';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import {
  closeNodes,
  expandNodes,
  getPathOfNode,
  isNodeExpandable,
  isNodeSelectable,
  modifyTreeNodeAtPath,
  treeNodeAtPath,
} from './scopesTreeUtils';
import { NodesMap, ScopesMap, SelectedScope, TreeNode } from './types';

const RECENT_SCOPES_KEY = 'grafana.scopes.recent';

export interface ScopesSelectorServiceState {
  // Used to indicate loading of the scopes themselves for example when applying them.
  loading: boolean;

  // Indicates loading children of a specific scope node.
  loadingNodeName: string | undefined;

  // Whether the scopes selector drawer is opened
  opened: boolean;

  nodes: NodesMap;
  scopes: ScopesMap;

  // Scopes that are selected and applied.
  appliedScopes: SelectedScope[];

  // Scopes that are selected but not applied.
  selectedScopes: SelectedScope[];

  tree: TreeNode | undefined;
}

export class ScopesSelectorService extends ScopesServiceBase<ScopesSelectorServiceState> {
  constructor(
    private apiClient: ScopesApiClient,
    private dashboardsService: ScopesDashboardsService
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
  }

  private expandOrFilterNode = async (scopeNodeId: string, query?: string) => {
    const path = getPathOfNode(scopeNodeId, this.state.nodes);

    const nodeToExpand = treeNodeAtPath(this.state.tree!, path);

    if (nodeToExpand) {
      if (nodeToExpand.scopeNodeId === '' || isNodeExpandable(this.state.nodes[nodeToExpand.scopeNodeId])) {
        if (!nodeToExpand.expanded || nodeToExpand.query !== query) {
          const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
            treeNode.expanded = true;
            treeNode.query = query || '';
          });
          this.updateState({ tree: newTree });
          await this.loadNodeChildren(path, nodeToExpand, query);
        }
      } else {
        throw new Error(`Trying to expand node at id ${scopeNodeId} that is not expandable`);
      }
    } else {
      throw new Error(`Trying to expand node at id ${scopeNodeId} not found`);
    }
  };

  private collapseNode = async (scopeNodeId: string) => {
    const path = getPathOfNode(scopeNodeId, this.state.nodes);

    const nodeToCollapse = treeNodeAtPath(this.state.tree!, path);
    if (nodeToCollapse) {
      const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
        treeNode.expanded = false;
        treeNode.query = '';
      });
      this.updateState({ tree: newTree });
    } else {
      throw new Error(`Trying to collapse node at path or id ${scopeNodeId} not found`);
    }
  };

  private loadNodeChildren = async (path: string[], treeNode: TreeNode, query?: string) => {
    this.updateState({ loadingNodeName: treeNode.scopeNodeId });

    // We are expanding node that wasn't yet expanded so we don't have any query to filter by yet.
    const childNodes = await this.apiClient.fetchNode({ parent: treeNode.scopeNodeId, query });

    const newNodes = { ...this.state.nodes };

    for (const node of childNodes) {
      newNodes[node.metadata.name] = node;
    }

    const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
      treeNode.children = {};
      for (const node of childNodes) {
        treeNode.children[node.metadata.name] = {
          expanded: false,
          scopeNodeId: node.metadata.name,
          query: '',
          children: undefined,
        };
      }
    });

    this.updateState({ tree: newTree, nodes: newNodes, loadingNodeName: undefined });
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
    // TODO we can just cache it here in the service
    this.apiClient.fetchScope(scopeNode.spec.linkId);

    const parentNode = this.state.nodes[scopeNode.spec.parentName!];
    const selectedScope = { scopeId: scopeNode.spec.linkId, scopeNodeId: scopeNode.metadata.name };

    if (
      // Parent says we can only select one scope at a time.
      parentNode.spec.disableMultiSelect ||
      // If nothing is selected yet we just add this one.
      this.state.selectedScopes.length === 0 ||
      // if something is selected we look at parent and see if we are selecting in the same category or not. As we
      // cannot select in multiple categories we only need to check the first selected node.
      this.state.nodes[this.state.selectedScopes[0].scopeNodeId!].spec.parentName !== scopeNode.spec.parentName
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

  public updateNode = async (scopeNodeId: string, expanded: boolean, query: string) => {
    if (expanded) {
      return this.expandOrFilterNode(scopeNodeId, query);
    }
    return this.collapseNode(scopeNodeId);
  };

  changeScopes = (scopeNames: string[]) => {
    return this.applyScopes(scopeNames.map((id) => ({ scopeId: id })));
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
    this.updateState({ appliedScopes: scopes, loading: scopes.length > 0 });

    if (scopes.length > 0) {
      // Fetches both dashboards and scope navigations
      this.dashboardsService.fetchDashboards(scopes.map((s) => s.scopeId));

      const fetchedScopes = await this.apiClient.fetchMultipleScopes(scopes.map((s) => s.scopeId));
      const newScopesState = { ...this.state.scopes };
      for (const scope of fetchedScopes) {
        newScopesState[scope.metadata.name] = scope;
      }
      this.addRecentScopes(fetchedScopes);
      this.updateState({ scopes: newScopesState, loading: false });
    }
  };

  public removeAllScopes = () => this.applyScopes([]);

  private addRecentScopes = (scopes: Scope[]) => {
    if (scopes.length === 0) {
      return;
    }

    const RECENT_SCOPES_MAX_LENGTH = 5;

    const recentScopes = this.getRecentScopes();
    recentScopes.unshift(scopes);
    localStorage.setItem(RECENT_SCOPES_KEY, JSON.stringify(recentScopes.slice(0, RECENT_SCOPES_MAX_LENGTH - 1)));
  };

  public getRecentScopes = (): Scope[][] => {
    const content = localStorage.getItem(RECENT_SCOPES_KEY);
    try {
      let recentScopes = JSON.parse(content || '[]');
      if (recentScopes[0]?.[0]?.scope) {
        // Backward compatibility
        recentScopes = recentScopes.map((s: Array<{ scope: Scope }>) => s.map((scope) => scope.scope));
      }
      // TODO: Make type safe
      // Filter out the current selection from recent scopes to avoid duplicates
      return recentScopes.filter((scopes: Scope[]) => {
        if (scopes.length !== this.state.selectedScopes.length) {
          return true;
        }
        const scopeSet = new Set(scopes.map((s) => s.metadata.name));
        return !this.state.appliedScopes.every((s) => scopeSet.has(s.scopeId));
      });
    } catch (e) {
      console.error('Failed to parse recent scopes', e, content);
      return [];
    }
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

    if (this.state.selectedScopes.length && this.state.selectedScopes[0].scopeNodeId) {
      let path = getPathOfNode(this.state.selectedScopes[0].scopeNodeId, this.state.nodes);
      // we want to expand the nodes parent not the node itself
      path = path.slice(0, path.length - 1);

      // Expand the nodes to the selected scope
      newTree = expandNodes(newTree, path);
    }

    this.resetSelection();
    this.updateState({ tree: newTree, opened: true });
  };

  public closeAndReset = () => {
    this.updateState({ opened: false, selectedScopes: [] });
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

  public searchAllNodes = (query: string, limit: number) => {
    return this.apiClient.fetchNode({ query, limit });
  };
}
