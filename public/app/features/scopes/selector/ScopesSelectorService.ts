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

  private expandOrFilterNode = async (pathOrScopeNodeId: string[] | string, query?: string) => {
    const path = Array.isArray(pathOrScopeNodeId)
      ? pathOrScopeNodeId
      : getPathOfNode(pathOrScopeNodeId, this.state.nodes);

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
        throw new Error(`Trying to expand node at path or id ${pathOrScopeNodeId} that is not expandable`);
      }
    } else {
      throw new Error(`Trying to expand node at path or id ${pathOrScopeNodeId} not found`);
    }
  };

  private collapseNode = async (pathOrScopeNodeId: string[] | string) => {
    const path = Array.isArray(pathOrScopeNodeId)
      ? pathOrScopeNodeId
      : getPathOfNode(pathOrScopeNodeId, this.state.nodes);

    const nodeToCollapse = treeNodeAtPath(this.state.tree!, path);
    if (nodeToCollapse) {
      const newTree = modifyTreeNodeAtPath(this.state.tree!, path, (treeNode) => {
        treeNode.expanded = false;
        treeNode.query = '';
      });
      this.updateState({ tree: newTree });
    } else {
      throw new Error(`Trying to collapse node at path or id ${pathOrScopeNodeId} not found`);
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

    console.log('update tree', this.state.tree);
    this.updateState({ tree: newTree, nodes: newNodes, loadingNodeName: undefined });
  };

  public selectScope = async (pathOrNodeScopeId: string[] | string) => {
    let scopeNode;
    if (Array.isArray(pathOrNodeScopeId)) {
      const nodeToSelect = treeNodeAtPath(this.state.tree!, pathOrNodeScopeId);
      if (!nodeToSelect) {
        throw new Error(`Trying to select node at path ${pathOrNodeScopeId} not found`);
      }

      scopeNode = this.state.nodes[nodeToSelect.scopeNodeId];
    } else {
      scopeNode = this.state.nodes[pathOrNodeScopeId];
    }

    if (!isNodeSelectable(scopeNode)) {
      throw new Error(`Trying to select node at path ${pathOrNodeScopeId} that is not selectable`);
    }

    if (!scopeNode.spec.linkId) {
      throw new Error(
        `Trying to select node ${scopeNode.metadata.name} at path ${pathOrNodeScopeId} that does not have a linkId`
      );
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
   * @param pathOrId This can be either a path or a scopeId or a scopeNodeId. Reason is there are cases where we want
   *   to deselect a scope that is applied for which we don't have a scopeNodeId, while in the tree scope selector we
   *   use scopeNodeIds.
   */
  public deselectScope = async (pathOrId: string[] | string) => {
    if (Array.isArray(pathOrId)) {
      const path = pathOrId;
      const nodeToDeselect = treeNodeAtPath(this.state.tree!, path);
      if (!nodeToDeselect) {
        throw new Error(`Trying to deselect node at path ${path} not found`);
      }

      const scopeNode = this.state.nodes[nodeToDeselect.scopeNodeId];
      const newSelectedScopes = this.state.selectedScopes.filter((s) => s.scopeNodeId !== scopeNode.metadata.name);
      this.updateState({ selectedScopes: newSelectedScopes });
      return;
    }

    // This is the case we just have some id so we directly remove it from selected scopes.
    let newSelectedScopes = this.state.selectedScopes.filter(
      (s) => s.scopeNodeId !== pathOrId && s.scopeId !== pathOrId
    );
    this.updateState({ selectedScopes: newSelectedScopes });
  };

  public updateNode = async (pathOrScopeNodeId: string[] | string, expanded: boolean, query: string) => {
    if (expanded) {
      return this.expandOrFilterNode(pathOrScopeNodeId, query);
    }
    return this.collapseNode(pathOrScopeNodeId);
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
      this.addRecentScopes(scopes);
      // Fetches both dashboards and scope navigations
      this.dashboardsService.fetchDashboards(scopes.map((s) => s.scopeId));

      const fetchedScopes = await this.apiClient.fetchMultipleScopes(scopes.map((s) => s.scopeId));
      const newScopesState = { ...this.state.scopes };
      for (const scope of fetchedScopes) {
        newScopesState[scope.metadata.name] = scope;
      }
      this.updateState({ scopes: newScopesState, loading: false });
    }
  };

  public removeAllScopes = () => this.applyScopes([]);

  private addRecentScopes = (scopes: SelectedScope[]) => {
    if (scopes.length === 0) {
      return;
    }

    const RECENT_SCOPES_MAX_LENGTH = 5;

    const recentScopes = this.getRecentScopes();
    recentScopes.unshift(scopes);
    localStorage.setItem(RECENT_SCOPES_KEY, JSON.stringify(recentScopes.slice(0, RECENT_SCOPES_MAX_LENGTH - 1)));
  };

  public getRecentScopes = (): SelectedScope[][] => {
    const recentScopes = JSON.parse(localStorage.getItem(RECENT_SCOPES_KEY) || '[]');
    // TODO: Make type safe
    // Filter out the current selection from recent scopes to avoid duplicates
    return recentScopes.filter((scopes: SelectedScope[]) => {
      if (scopes.length !== this.state.selectedScopes.length) {
        return true;
      }
      const scopeSet = new Set(scopes.map((s) => s.scopeId));
      return !this.state.appliedScopes.every((s) => scopeSet.has(s.scopeId));
    });
  };

  /**
   * Opens the scopes selector drawer and loads the root nodes if they are not loaded yet.
   */
  public open = async () => {
    if (!this.state.tree?.children || Object.keys(this.state.tree?.children).length === 0) {
      await this.expandOrFilterNode(['']);
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
    this.updateState({ selectedScopes: [] });
  };

  public searchAllNodes = (query: string, limit: number) => {
    return this.apiClient.fetchNode({ query, limit });
  };
}
