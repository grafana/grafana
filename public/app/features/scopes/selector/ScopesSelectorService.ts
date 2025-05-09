import { ScopeNode } from '@grafana/data';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import { NodesMap, ScopesMap, SelectedScope, TreeNode } from './types';

const RECENT_SCOPES_KEY = 'grafana.scopes.recent';

export interface ScopesSelectorServiceState {
  loading: boolean;
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

  private treeNodeAtPath(pathOrScopeNodeId: string[] | string) {
    let path: string[];
    if (Array.isArray(pathOrScopeNodeId)) {
      path = pathOrScopeNodeId;
    } else {
      path = this.getPathOfNode(this.state.nodes[pathOrScopeNodeId]);
    }

    if (!this.state.tree || path.length < 1) {
      return undefined;
    }

    let treeNode: TreeNode | undefined = this.state.tree;

    if (path.length === 1 && path[0] === '') {
      return treeNode;
    }

    for (const section of path.slice(1)) {
      treeNode = treeNode.children?.[section];
      if (!treeNode) {
        return undefined;
      }
    }

    return treeNode;
  }

  private expandNode = async (pathOrScopeNodeId: string[] | string) => {
    const nodeToExpand = this.treeNodeAtPath(pathOrScopeNodeId);
    if (nodeToExpand) {
      if (nodeToExpand.scopeNodeId === '' || isNodeExpandable(this.state.nodes[nodeToExpand.scopeNodeId])) {
        nodeToExpand.expanded = true;
        if (!nodeToExpand.children) {
          await this.loadNodeChildren(nodeToExpand);
        }
      } else {
        throw new Error(`Trying to expand node at path or id ${pathOrScopeNodeId} that is not expandable`);
      }
    } else {
      throw new Error(`Trying to expand node at path or id ${pathOrScopeNodeId} not found`);
    }
  };

  private collapseNode = async (pathOrScopeNodeId: string[] | string) => {
    const nodeToCollapse = this.treeNodeAtPath(pathOrScopeNodeId);
    if (nodeToCollapse) {
      nodeToCollapse.expanded = true;
    } else {
      throw new Error(`Trying to collapse node at path or id ${pathOrScopeNodeId} not found`);
    }
  };

  private filterNodes = async (pathOrScopeNodeId: string[] | string, query: string) => {
    const nodeToFilter = this.treeNodeAtPath(pathOrScopeNodeId);
    if (nodeToFilter) {
      await this.loadNodeChildren(nodeToFilter, query);
    } else {
      throw new Error(`Trying to filter node children at path or id ${pathOrScopeNodeId} not found`);
    }
  };

  private loadNodeChildren = async (treeNode: TreeNode, query?: string) => {
    this.updateState({ tree: this.state.tree, loadingNodeName: treeNode.scopeNodeId });

    // We are expanding node that wasn't yet expanded so we don't have any query to filter by yet.
    const childNodes = await this.apiClient.fetchNode({ parent: treeNode.scopeNodeId, query });

    const newNodes = { ...this.state.nodes };
    treeNode.children = {};
    for (const node of childNodes) {
      treeNode.children[node.metadata.name] = {
        expanded: false,
        scopeNodeId: node.metadata.name,
        query: '',
        children: undefined,
      };
      newNodes[node.metadata.name] = node;
    }

    this.updateState({ nodes: newNodes, loadingNodeName: undefined });
  };

  public selectScope = async (pathOrNodeScopeId: string[] | string) => {
    let scopeNode;
    if (Array.isArray(pathOrNodeScopeId)) {
      const nodeToSelect = this.treeNodeAtPath(pathOrNodeScopeId);
      if (!nodeToSelect) {
        throw new Error(`Trying to select node at path ${pathOrNodeScopeId} not found`);
      }

      if (!isNodeSelectable(this.state.nodes[nodeToSelect.scopeNodeId])) {
        throw new Error(`Trying to select node at path ${pathOrNodeScopeId} that is not selectable`);
      }

      scopeNode = this.state.nodes[nodeToSelect.scopeNodeId];
    } else {
      scopeNode = this.state.nodes[pathOrNodeScopeId];
    }

    if (!scopeNode.spec.linkId) {
      throw new Error(
        `Trying to select node ${scopeNode.metadata.name} at path ${pathOrNodeScopeId} that does not have a linkId`
      );
    }

    this.apiClient.fetchScope(scopeNode.spec.linkId);

    const parentNode = this.state.nodes[scopeNode.spec.parentName!];
    const selectedNode = { scopeId: scopeNode.spec.linkId, scopeNodeId: scopeNode.metadata.name };

    if (
      // Parent says we can only select one scope at a time.
      parentNode.spec.disableMultiSelect ||
      // If nothing is selected yet we just add this one.
      this.state.selectedScopes.length === 0 ||
      // if something is selected we look at parent and see if we are selecting in the same category or not. As we
      // cannot select in multiple categories we only need to check the first selected node.
      this.state.nodes[this.state.selectedScopes[0].scopeNodeId!].spec.parentName !== scopeNode.spec.parentName
    ) {
      this.updateState({ selectedScopes: [selectedNode] });
    } else {
      this.updateState({ selectedScopes: [...this.state.selectedScopes, selectedNode] });
    }
  };

  public deselectScope = async (pathOrScopeId: string[] | string) => {
    if (Array.isArray(pathOrScopeId)) {
      const path = pathOrScopeId;
      const nodeToDeselect = this.treeNodeAtPath(path);
      if (!nodeToDeselect) {
        throw new Error(`Trying to deselect node at path ${path} not found`);
      }

      const scopeNode = this.state.nodes[nodeToDeselect.scopeNodeId];
      const newSelectedScopes = this.state.selectedScopes.filter((s) => s.scopeNodeId !== scopeNode.metadata.name);
      this.updateState({ selectedScopes: newSelectedScopes });
      return;
    }

    const newSelectedScopes = this.state.selectedScopes.filter((s) => s.scopeId !== pathOrScopeId);
    this.updateState({ selectedScopes: newSelectedScopes });
  };

  public updateNode = async (pathOrScopeNodeId: string[] | string, expanded: boolean, query: string) => {
    if (expanded) {
      if (query) {
        return this.filterNodes(pathOrScopeNodeId, query);
      }
      return this.expandNode(pathOrScopeNodeId);
    }
    return this.collapseNode(pathOrScopeNodeId);
  };

  changeScopes = (scopeNames: string[]) => {
    return this.applyScopes(scopeNames.map((id) => ({ scopeId: id })));
  };

  /**
   * Apply the selected scopes. Apart from setting the scopes it also fetches the scope metadata and also loads the
   * related dashboards.
   * @param treeScopes The scopes to be applied. If not provided the treeScopes state is used which was populated
   *   before for example by toggling the scopes in the scoped tree UI.
   */
  private applyScopes = async (scopes: SelectedScope[]) => {
    if (
      this.state.selectedScopes.length === scopes.length &&
      this.state.selectedScopes.every((selectedScope) => scopes.find((s) => selectedScope.scopeId === s.scopeId))
    ) {
      return;
    }

    // Apply the scopes right away even though we don't have the metadata yet.
    this.updateState({ appliedScopes: scopes, loading: true });
    this.addRecentScopes(scopes);

    if (scopes.length > 0) {
      this.updateState({ loading: true });
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
      await this.expandNode(['']);
    }

    // First close all nodes
    let newTree = closeNodes(this.state.tree!);

    if (this.state.selectedScopes.length && this.state.selectedScopes[0].scopeNodeId) {
      const node = this.state.nodes[this.state.selectedScopes[0].scopeNodeId];
      const path = this.getPathOfNode(node);

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

  private getPathOfNode = (node: ScopeNode): string[] => {
    return getPathOfNode(node, this.state.nodes);
  };
}

/**
 * Creates a deep copy of the node tree with expanded prop set to false.
 */
function closeNodes(tree: TreeNode): TreeNode {
  const node = { ...tree };
  node.expanded = false;
  if (node.children) {
    node.children = { ...node.children };
    for (const key of Object.keys(node.children)) {
      node.children[key] = closeNodes(node.children[key]);
    }
  }
  return node;
}

function expandNodes(tree: TreeNode, path: string[]): TreeNode {
  let newTree = { ...tree };
  let currentTree = newTree;
  newTree.expanded = true;
  // Remove the root segment
  const newPath = path.slice(1);

  for (const segment of newPath) {
    const node = currentTree.children?.[segment];
    if (!node) {
      throw new Error(`Node ${segment} not found in tree`);
    }

    const newNode = { ...node };
    newTree.children = { ...newTree.children };
    newTree.children[segment] = newNode;
    newNode.expanded = true;
    currentTree = newNode;
  }

  return newTree;
}

export function isNodeExpandable(node: ScopeNode) {
  return node.spec.nodeType === 'container';
}

export function isNodeSelectable(node: ScopeNode) {
  return node.spec.linkType === 'scope';
}

export function getPathOfNode(node: ScopeNode, nodes: NodesMap): string[] {
  const path = [node.metadata.name];
  let parent = node.spec.parentName;
  while (parent) {
    path.unshift(parent);
    parent = nodes[parent].spec.parentName;
  }
  path.unshift('');
  return path;
}
