import { isEqual } from 'lodash';

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
  selectedScopes: SelectedScope[];
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

  public updateNode = async (path: string[], expanded: boolean, query: string) => {
    let nodes = { ...this.state.nodes };
    let currentLevel: NodesMap = nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevel = currentLevel[path[idx]].nodes;
    }

    const loadingNodeName = path[path.length - 1];
    const currentNode = currentLevel[loadingNodeName];

    const differentQuery = currentNode.query !== query;

    currentNode.expanded = expanded;
    currentNode.query = query;

    if (expanded || differentQuery) {
      this.updateState({ nodes, loadingNodeName });

      // fetchNodeApi does not throw just return empty object
      const childNodes = await this.apiClient.fetchNode(loadingNodeName, query);
      if (loadingNodeName === this.state.loadingNodeName) {
        const [selectedScopes, treeScopes] = this.getScopesAndTreeScopesWithPaths(
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

  private setNewScopes = async (treeScopes = this.state.treeScopes) => {
    if (isEqual(treeScopes, this.getTreeScopesFromSelectedScopes(this.state.selectedScopes))) {
      return;
    }

    let selectedScopes = treeScopes.map(({ scopeName, path }) => ({
      scope: getEmptyScopeObject(scopeName),
      path,
    }));
    this.updateState({ selectedScopes, treeScopes, loading: true });
    this.dashboardsService.fetchDashboards(selectedScopes.map(({ scope }) => scope.metadata.name));

    selectedScopes = await this.apiClient.fetchMultipleScopes(treeScopes);
    this.updateState({ selectedScopes, loading: false });
  };

  public removeAllScopes = () => this.setNewScopes([]);

  public open = async () => {
    if (Object.keys(this.state.nodes[''].nodes).length === 0) {
      await this.updateNode([''], true, '');
    }

    let nodes = { ...this.state.nodes };

    // First close all nodes
    nodes = this.closeNodes(nodes);

    // Extract the path of a scope
    let path = [...(this.state.selectedScopes[0]?.path ?? ['', ''])];
    path.splice(path.length - 1, 1);

    // Expand the nodes to the selected scope
    nodes = expandNodes(nodes, path);

    this.updateState({ nodes, opened: true });
  };

  public closeAndReset = () => {
    this.updateState({ opened: false, treeScopes: this.getTreeScopesFromSelectedScopes(this.state.selectedScopes) });
  };

  public closeAndApply = () => {
    this.updateState({ opened: false });
    this.setNewScopes();
  };

  private closeNodes = (nodes: NodesMap): NodesMap => {
    return Object.entries(nodes).reduce<NodesMap>((acc, [id, node]) => {
      acc[id] = {
        ...node,
        expanded: false,
        nodes: this.closeNodes(node.nodes),
      };

      return acc;
    }, {});
  };

  private getTreeScopesFromSelectedScopes = (scopes: SelectedScope[]): TreeScope[] => {
    return scopes.map(({ scope, path }) => ({
      scopeName: scope.metadata.name,
      path,
    }));
  };

  // helper func to get the selected/tree scopes together with their paths
  // needed to maintain selected scopes in tree for example when navigating
  // between categories or when loading scopes from URL to find the scope's path
  private getScopesAndTreeScopesWithPaths = (
    selectedScopes: SelectedScope[],
    treeScopes: TreeScope[],
    path: string[],
    childNodes: NodesMap
  ): [SelectedScope[], TreeScope[]] => {
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
  };
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
