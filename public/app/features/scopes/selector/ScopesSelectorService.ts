import { isEqual, last } from 'lodash';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';
import { getEmptyScopeObject } from '../utils';

import { NodeReason, NodesMap, SelectedScope, TreeScope } from './types';

export interface ScopesSelectorServiceState {
  loading: boolean;

  // Whether the scopes selector drawer is opened
  opened: boolean;
  loadingNodeName: string | undefined;
  nodes: NodesMap;

  // Scopes that are selected and applied.
  selectedScopes: SelectedScope[];

  // Representation of what is selected in the tree in the UI. This state may not be yet applied to the selectedScopes.
  treeScopes: TreeScope[];
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
      nodes: {
        '': {
          name: '',
          reason: NodeReason.Result,
          nodeType: 'container',
          title: '',
          expandable: true,
          selectable: false,
          expanded: true,
          query: '',
          nodes: {},
        },
      },
      selectedScopes: [],
      treeScopes: [],
    });
  }

  /**
   * Updates a node at a path with the new expanded state and query. If we expand a node or change the query we will
   * load its children. The expectation is that this is used to expand or filter nodes that are already loaded, not
   * load a deep nested node which parents weren't loaded yet.
   * @param path Path to the nodes. Each element in the path is a node name. Has to have at least one element.
   * @param expanded
   * @param query Substring of the title to filter by.
   */
  public updateNode = async (path: string[], expanded: boolean, query: string) => {
    if (path.length < 1) {
      return;
    }

    // Making a copy as we will be changing this in place and then updating state later.
    // This though does not make a deep copy so you cannot rely on reference of nested nodes changing.
    const nodes = { ...this.state.nodes };
    let currentLevel: NodesMap = nodes;
    let loadingNodeName = path[0];

    if (path.length > 1) {
      const pathToParent = path.slice(0, path.length - 1);
      currentLevel = getNodesAtPath(nodes, pathToParent);
      loadingNodeName = last(path)!;
    }

    const currentNode = currentLevel[loadingNodeName];
    const differentQuery = currentNode.query !== query;

    currentNode.expanded = expanded;
    currentNode.query = query;

    if (expanded || differentQuery) {
      // Means we have to fetch the children of the node

      this.updateState({ nodes, loadingNodeName });

      // fetchNodeApi does not throw just returns empty object.
      // Load all the children of the loadingNodeName
      const childNodes = await this.apiClient.fetchNode(loadingNodeName, query);
      if (loadingNodeName === this.state.loadingNodeName) {
        const [selectedScopes, treeScopes] = getScopesAndTreeScopesWithPaths(
          this.state.selectedScopes,
          this.state.treeScopes,
          path,
          childNodes
        );

        const persistedNodes = treeScopes
          .map(({ path }) => path[path.length - 1])
          .filter((nodeName) => nodeName in currentNode.nodes && !(nodeName in childNodes))
          .reduce<NodesMap>((acc, nodeName) => {
            acc[nodeName] = {
              ...currentNode.nodes[nodeName],
              reason: NodeReason.Persisted,
            };

            return acc;
          }, {});

        currentNode.nodes = { ...persistedNodes, ...childNodes };

        this.updateState({ nodes, selectedScopes, treeScopes, loadingNodeName: undefined });
      }
    } else {
      this.updateState({ nodes, loadingNodeName: undefined });
    }
  };

  /**
   * Toggle a selection of a scope node. Only leaf nodes representing an actual scope can be toggled so the path should
   * represent such node.
   *
   * The main function of this method is to update the treeScopes state which is a representation of what is selected in
   * the UI and to prefetch the scope data from the server.
   * @param path
   */
  public toggleNodeSelect = (path: string[]) => {
    let treeScopes = [...this.state.treeScopes];

    let parentNode = this.state.nodes[''];

    for (let idx = 1; idx < path.length - 1; idx++) {
      parentNode = parentNode.nodes[path[idx]];
    }

    const nodeName = path[path.length - 1];
    const { linkId } = parentNode.nodes[nodeName];

    const selectedIdx = treeScopes.findIndex(({ scopeName }) => scopeName === linkId);

    if (selectedIdx === -1) {
      // We prefetch the scope when clicking on it. This will mean that once the selection is applied in closeAndApply()
      // we already have all the scopes in cache and don't need to fetch all of them again is multiple requests.
      this.apiClient.fetchScope(linkId!);

      const selectedFromSameNode =
        treeScopes.length === 0 ||
        Object.values(parentNode.nodes).some(({ linkId }) => linkId === treeScopes[0].scopeName);

      const treeScope = {
        scopeName: linkId!,
        path,
      };

      this.updateState({
        treeScopes: parentNode?.disableMultiSelect || !selectedFromSameNode ? [treeScope] : [...treeScopes, treeScope],
      });
    } else {
      treeScopes.splice(selectedIdx, 1);

      this.updateState({ treeScopes });
    }
  };

  changeScopes = (scopeNames: string[]) => this.setNewScopes(scopeNames.map((scopeName) => ({ scopeName, path: [] })));

  /**
   * Apply the selected scopes. Apart from setting the scopes it also fetches the scope metadata and also loads the
   * related dashboards.
   * @param treeScopes The scopes to be applied. If not provided the treeScopes state is used which was populated
   *   before for example by toggling the scopes in the scoped tree UI.
   */
  private setNewScopes = async (treeScopes = this.state.treeScopes) => {
    if (isEqual(treeScopes, getTreeScopesFromSelectedScopes(this.state.selectedScopes))) {
      return;
    }

    let selectedScopes = treeScopes.map(({ scopeName, path }) => ({
      scope: getEmptyScopeObject(scopeName),
      path,
    }));

    // Apply the scopes right away even though we don't have the metadata yet.
    this.updateState({ selectedScopes, treeScopes, loading: true });

    // Fetches both dashboards and scope navigations
    this.dashboardsService.fetchDashboards(selectedScopes.map(({ scope }) => scope.metadata.name));

    selectedScopes = await this.apiClient.fetchMultipleScopes(treeScopes);
    this.updateState({ selectedScopes, loading: false });
  };

  public removeAllScopes = () => this.setNewScopes([]);

  /**
   * Opens the scopes selector drawer and loads the root nodes if they are not loaded yet.
   */
  public open = async () => {
    if (Object.keys(this.state.nodes[''].nodes).length === 0) {
      await this.updateNode([''], true, '');
    }

    let nodes = { ...this.state.nodes };

    // First close all nodes
    nodes = closeNodes(nodes);

    // Extract the path of a scope
    let path = [...(this.state.selectedScopes[0]?.path ?? ['', ''])];
    path.splice(path.length - 1, 1);

    // Expand the nodes to the selected scope
    nodes = expandNodes(nodes, path);

    this.updateState({ nodes, opened: true });
  };

  public closeAndReset = () => {
    // Reset the treeScopes if we don't want them actually applied.
    this.updateState({ opened: false, treeScopes: getTreeScopesFromSelectedScopes(this.state.selectedScopes) });
  };

  public closeAndApply = () => {
    this.updateState({ opened: false });
    this.setNewScopes();
  };
}

/**
 * Creates a deep copy of the node tree with expanded prop set to false.
 * @param nodes
 */
function closeNodes(nodes: NodesMap): NodesMap {
  return Object.entries(nodes).reduce<NodesMap>((acc, [id, node]) => {
    acc[id] = {
      ...node,
      expanded: false,
      nodes: closeNodes(node.nodes),
    };

    return acc;
  }, {});
}

function getTreeScopesFromSelectedScopes(scopes: SelectedScope[]): TreeScope[] {
  return scopes.map(({ scope, path }) => ({
    scopeName: scope.metadata.name,
    path,
  }));
}

// helper func to get the selected/tree scopes together with their paths
// needed to maintain selected scopes in tree for example when navigating
// between categories or when loading scopes from URL to find the scope's path
function getScopesAndTreeScopesWithPaths(
  selectedScopes: SelectedScope[],
  treeScopes: TreeScope[],
  path: string[],
  childNodes: NodesMap
): [SelectedScope[], TreeScope[]] {
  const childNodesArr = Object.values(childNodes);

  // Get all scopes without paths
  // We use tree scopes as the list is always up to date as opposed to selected scopes which can be outdated
  const scopeNamesWithoutPaths = treeScopes.filter(({ path }) => path.length === 0).map(({ scopeName }) => scopeName);

  // We search for the path of each scope name without a path
  const scopeNamesWithPaths = scopeNamesWithoutPaths.reduce<Record<string, string[]>>((acc, scopeName) => {
    const possibleParent = childNodesArr.find((childNode) => childNode.selectable && childNode.linkId === scopeName);

    if (possibleParent) {
      acc[scopeName] = [...path, possibleParent.name];
    }

    return acc;
  }, {});

  // Update the paths of the selected scopes based on what we found
  const newSelectedScopes = selectedScopes.map((selectedScope) => {
    if (selectedScope.path.length > 0) {
      return selectedScope;
    }

    return {
      ...selectedScope,
      path: scopeNamesWithPaths[selectedScope.scope.metadata.name] ?? [],
    };
  });

  // Update the paths of the tree scopes based on what we found
  const newTreeScopes = treeScopes.map((treeScope) => {
    if (treeScope.path.length > 0) {
      return treeScope;
    }

    return {
      ...treeScope,
      path: scopeNamesWithPaths[treeScope.scopeName] ?? [],
    };
  });

  return [newSelectedScopes, newTreeScopes];
}

function expandNodes(nodes: NodesMap, path: string[]): NodesMap {
  nodes = { ...nodes };
  let currentNodes = nodes;

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];

    currentNodes[nodeId] = {
      ...currentNodes[nodeId],
      expanded: true,
    };
    currentNodes = currentNodes[nodeId].nodes;
  }

  return nodes;
}

function getNodesAtPath(nodes: NodesMap, path: string[]): NodesMap {
  let currentNodes = nodes;

  for (const section of path) {
    currentNodes = currentNodes[section].nodes;
  }

  return currentNodes;
}
