import { isEqual, last } from 'lodash';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';
import { getEmptyScopeObject } from '../utils';

import { Node, NodeReason, NodesMap, SelectedScope, ToggleNode, TreeScope } from './types';

const RECENT_SCOPES_KEY = 'grafana.scopes.recent';

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
    let parentNode: Node | undefined = nodes[''];
    let loadingNodeName = path[0];
    let currentNode = nodes[''];

    if (path.length > 1) {
      const pathToParent = path.slice(1, path.length - 1);
      parentNode = getNodesAtPath(nodes[''], pathToParent);
      loadingNodeName = last(path)!;

      if (!parentNode) {
        console.warn('No parent node found for path:', path);
        return;
      }

      currentNode = parentNode.nodes[loadingNodeName];
    }

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
   */
  public toggleNodeSelect = (node: ToggleNode) => {
    if ('scopeName' in node) {
      // This is for a case where we don't have a path yet. For example on init we get the selected from url, but
      // just the names. If we want to deselect them without knowing where in the tree they are we can just pass the
      // name.

      const newTreeScopes = this.state.treeScopes.filter((s) => s.scopeName !== node.scopeName);
      if (newTreeScopes.length !== this.state.treeScopes.length) {
        this.updateState({ treeScopes: newTreeScopes });
        return;
      }
    }

    if (!node.path) {
      console.warn('Node cannot be selected without both path and name', node);
      return;
    }

    let treeScopes = [...this.state.treeScopes];
    const parentNode = getNodesAtPath(this.state.nodes[''], node.path.slice(1, -1));

    if (!parentNode) {
      // Either the path is wrong or we don't have the nodes loaded yet. So let's check the selected tree nodes if we
      // can remove something based on scope name.
      const scopeName = node.path.at(-1);
      const newTreeScopes = treeScopes.filter((s) => s.scopeName !== scopeName);
      if (newTreeScopes.length !== treeScopes.length) {
        this.updateState({ treeScopes: newTreeScopes });
      } else {
        console.warn('No node found for path:', node.path);
      }
      return;
    }

    const nodeName = node.path[node.path.length - 1];
    const { linkId, title } = parentNode.nodes[nodeName];

    const selectedIdx = treeScopes.findIndex(({ scopeName }) => scopeName === linkId);

    if (selectedIdx === -1) {
      // We are selecting a new node.

      // We prefetch the scope when clicking on it. This will mean that once the selection is applied in closeAndApply()
      // we already have all the scopes in cache and don't need to fetch all of them again is multiple requests.
      this.apiClient.fetchScope(linkId!);

      const treeScope: TreeScope = {
        scopeName: linkId!,
        path: node.path,
        title,
      };

      // We cannot select multiple scopes with different parents only. In that case we will just deselect all the
      // others.
      const selectedFromSameNode =
        treeScopes.length === 0 ||
        Object.values(parentNode.nodes).some(({ linkId }) => linkId === treeScopes[0].scopeName);

      this.updateState({
        treeScopes: parentNode?.disableMultiSelect || !selectedFromSameNode ? [treeScope] : [...treeScopes, treeScope],
      });
    } else {
      // We are deselecting already selected node.
      treeScopes.splice(selectedIdx, 1);
      this.updateState({ treeScopes });
    }
  };

  changeScopes = (scopeNames: string[]) => {
    return this.setNewScopes(scopeNames.map((scopeName) => ({ scopeName, path: [], title: scopeName })));
  };

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

    let selectedScopes = treeScopes.map(({ scopeName, path, title }) => ({
      scope: getEmptyScopeObject(scopeName, title),
      path,
    }));

    // Apply the scopes right away even though we don't have the metadata yet.
    this.updateState({ selectedScopes, treeScopes, loading: true });

    // Fetches both dashboards and scope navigations
    this.dashboardsService.fetchDashboards(selectedScopes.map(({ scope }) => scope.metadata.name));

    if (treeScopes.length > 0) {
      selectedScopes = await this.apiClient.fetchMultipleScopes(treeScopes);
      if (selectedScopes.length > 0) {
        this.addRecentScopes(selectedScopes);
      }
    }

    // Make sure the treeScopes also have the right title as we use it to display the selection in the UI while to set
    // the scopes you just need the name/id.
    const updatedTreeScopes = treeScopes.map((treeScope) => {
      const matchingSelectedScope = selectedScopes.find(
        (selectedScope) => selectedScope.scope.metadata.name === treeScope.scopeName
      );
      return {
        ...treeScope,
        title: matchingSelectedScope?.scope.spec.title || treeScope.title,
      };
    });

    this.updateState({ selectedScopes, treeScopes: updatedTreeScopes, loading: false });
  };

  public removeAllScopes = () => this.setNewScopes([]);

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
    const filteredScopes = recentScopes.filter((scopes: SelectedScope[]) => {
      if (scopes.length !== this.state.selectedScopes.length) {
        return true;
      }
      const scopeSet = new Set(scopes.map((s) => s.scope.metadata.name));
      return !this.state.selectedScopes.every((s) => scopeSet.has(s.scope.metadata.name));
    });

    return filteredScopes.map((scopes: SelectedScope[]) => scopes);
  };

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
    return this.apply();
  };

  public apply = () => {
    return this.setNewScopes();
  };

  public resetSelection = () => {
    this.updateState({ treeScopes: getTreeScopesFromSelectedScopes(this.state.selectedScopes) });
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
    title: scope.spec.title,
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

function getNodesAtPath(node: Node, path: string[]): Node | undefined {
  let currentNode = node;

  for (const section of path) {
    if (currentNode === undefined) {
      return undefined;
    }
    currentNode = currentNode.nodes[section];
  }

  return currentNode;
}
