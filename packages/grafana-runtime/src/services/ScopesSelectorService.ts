import { isEqual } from 'lodash';
import { BehaviorSubject } from 'rxjs';

import { ScopesNodesMapItemReason, ScopesNodesMap, SelectedScope, TreeScope, Scope, ScopeNode } from '@grafana/data';

import { config } from '../config';

import { getBackendSrv } from './backendSrv';
import { getScopesDashboardsService } from './scopes';

export interface ScopesSelectorServiceState {
  isEnabled: boolean;
  isLoading: boolean;
  isOpened: boolean;
  isReadOnly: boolean;
  loadingNodeName: string | undefined;
  nodes: ScopesNodesMap;
  scopes: SelectedScope[];
  treeScopes: TreeScope[];
}

const getInitialState = (): ScopesSelectorServiceState => ({
  isEnabled: false,
  isLoading: false,
  isOpened: false,
  isReadOnly: false,
  loadingNodeName: undefined,
  nodes: {
    '': {
      name: '',
      reason: ScopesNodesMapItemReason.Result,
      nodeType: 'container',
      title: '',
      isExpandable: true,
      isSelectable: false,
      isExpanded: true,
      query: '',
      nodes: {},
    },
  },
  scopes: [],
  treeScopes: [],
});

export class ScopesSelectorService {
  private _state: BehaviorSubject<ScopesSelectorServiceState>;

  private scopesCache = new Map<string, Promise<Scope>>();

  constructor() {
    this._state = new BehaviorSubject<ScopesSelectorServiceState>(getInitialState());

    this.fetchBaseNodes();
  }

  public reset() {
    this.updateState(getInitialState());
  }

  public get state() {
    return this._state.getValue();
  }

  public get stateObservable() {
    return this._state.asObservable();
  }

  public async updateNode(path: string[], isExpanded: boolean, query: string) {
    let nodes = { ...this.state.nodes };
    let currentLevel: ScopesNodesMap = nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevel = currentLevel[path[idx]].nodes;
    }

    const name = path[path.length - 1];
    const currentNode = currentLevel[name];

    const isDifferentQuery = currentNode.query !== query;

    currentNode.isExpanded = isExpanded;
    currentNode.query = query;

    if (isExpanded || isDifferentQuery) {
      this.updateState({ nodes, loadingNodeName: name });

      const childNodes = await this.fetchNodesApi(name, query);

      const [scopes, treeScopes] = getScopesAndTreeScopesWithPaths(
        this.state.scopes,
        this.state.treeScopes,
        path,
        childNodes
      );

      const persistedNodes = treeScopes
        .map(({ path }) => path[path.length - 1])
        .filter((nodeName) => nodeName in currentNode.nodes && !(nodeName in childNodes))
        .reduce<ScopesNodesMap>((acc, nodeName) => {
          acc[nodeName] = {
            ...currentNode.nodes[nodeName],
            reason: ScopesNodesMapItemReason.Persisted,
          };

          return acc;
        }, {});

      currentNode.nodes = { ...persistedNodes, ...childNodes };

      this.updateState({
        loadingNodeName: undefined,
        nodes,
        scopes,
        treeScopes,
      });
    } else {
      this.updateState({ loadingNodeName: undefined, nodes });
    }
  }

  public toggleNodeSelect(path: string[]) {
    let treeScopes = [...this.state.treeScopes];

    let parentNode = this.state.nodes[''];

    for (let idx = 1; idx < path.length - 1; idx++) {
      parentNode = parentNode.nodes[path[idx]];
    }

    const nodeName = path[path.length - 1];
    const { linkId } = parentNode.nodes[nodeName];

    const selectedIdx = treeScopes.findIndex(({ scopeName }) => scopeName === linkId);

    if (selectedIdx === -1) {
      this.fetchScopeApi(linkId!);

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
  }

  public openPicker() {
    if (!this.state.isReadOnly) {
      let nodes = { ...this.state.nodes };

      // First close all nodes
      nodes = this.closeNodes(nodes);

      // Extract the path of a scope
      let path = [...(this.state.scopes[0]?.path ?? ['', ''])];
      path.splice(path.length - 1, 1);

      // Expand the nodes to the selected scope
      nodes = this.expandNodes(nodes, path);

      this.updateState({ isOpened: true, nodes });
    }
  }

  public closePicker() {
    this.updateState({ isOpened: false });
  }

  public async updateScopes(treeScopes = this.state.treeScopes) {
    if (isEqual(treeScopes, getTreeScopesFromSelectedScopes(this.state.scopes))) {
      return;
    }

    this.updateState({
      // Update the scopes with the basic scopes otherwise they'd be lost between URL syncs
      scopes: treeScopes.map(({ scopeName, path }) => ({ scope: getBasicScope(scopeName), path })),
      treeScopes,
      isLoading: true,
    });

    getScopesDashboardsService().fetchDashboards(treeScopes.map(({ scopeName }) => scopeName));

    const scopes = await this.fetchSelectedScopesApi(treeScopes);

    this.updateState({ scopes, isLoading: false });
  }

  public resetDirtyScopeNames() {
    this.updateState({
      treeScopes: getTreeScopesFromSelectedScopes(this.state.scopes),
    });
  }

  public async removeAllScopes() {
    return this.updateScopes([]);
  }

  public enterReadOnly() {
    this.updateState({ isReadOnly: true, isOpened: false });
  }

  public exitReadOnly() {
    this.updateState({ isReadOnly: false });
  }

  public enable() {
    this.updateState({ isEnabled: true });
  }

  public disable() {
    this.updateState({ isEnabled: false });
  }

  private updateState(newState: Partial<ScopesSelectorServiceState>) {
    this._state.next({ ...this.state, ...newState });
  }

  private fetchBaseNodes() {
    return this.updateNode([''], true, '');
  }

  private closeNodes(nodes: ScopesNodesMap): ScopesNodesMap {
    return Object.entries(nodes).reduce<ScopesNodesMap>((acc, [id, node]) => {
      acc[id] = {
        ...node,
        isExpanded: false,
        nodes: this.closeNodes(node.nodes),
      };

      return acc;
    }, {});
  }

  private expandNodes(nodes: ScopesNodesMap, path: string[]): ScopesNodesMap {
    nodes = { ...nodes };
    let currentNodes = nodes;

    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];

      currentNodes[nodeId] = {
        ...currentNodes[nodeId],
        isExpanded: true,
      };
      currentNodes = currentNodes[nodeId].nodes;
    }

    return nodes;
  }

  public async fetchNodesApi(parent: string, query: string): Promise<ScopesNodesMap> {
    try {
      const scopeNodes =
        (
          await getBackendSrv().get<{ items: ScopeNode[] }>(
            `/apis/scope.grafana.app/v0alpha1/namespaces/${config.namespace ?? 'default'}/find/scope_node_children`,
            { parent, query }
          )
        )?.items ?? [];

      return scopeNodes.reduce<ScopesNodesMap>((acc, { metadata: { name }, spec }) => {
        acc[name] = {
          name,
          ...spec,
          isExpandable: spec.nodeType === 'container',
          isSelectable: spec.linkType === 'scope',
          isExpanded: false,
          query: '',
          reason: ScopesNodesMapItemReason.Result,
          nodes: {},
        };
        return acc;
      }, {});
    } catch (err) {
      return {};
    }
  }

  public async fetchScopeApi(name: string): Promise<Scope> {
    if (this.scopesCache.has(name)) {
      return this.scopesCache.get(name)!;
    }

    const response = new Promise<Scope>(async (resolve) => {
      const basicScope = getBasicScope(name);

      try {
        const serverScope =
          (await getBackendSrv().get<Scope>(
            `/apis/scope.grafana.app/v0alpha1/namespaces/${config.namespace ?? 'default'}/scopes/${name}`
          )) ?? {};

        const scope = {
          ...basicScope,
          metadata: {
            ...basicScope.metadata,
            ...serverScope.metadata,
          },
          spec: {
            ...basicScope.spec,
            ...serverScope.spec,
          },
        };

        resolve(scope);
      } catch (err) {
        this.scopesCache.delete(name);

        resolve(basicScope);
      }
    });

    this.scopesCache.set(name, response);

    return response;
  }

  public async fetchSelectedScopesApi(treeScopes: TreeScope[]): Promise<SelectedScope[]> {
    const scopes = await Promise.all(treeScopes.map(({ scopeName }) => this.fetchScopeApi(scopeName)));

    return scopes.reduce<SelectedScope[]>((acc, scope, idx) => {
      acc.push({
        scope,
        path: treeScopes[idx].path,
      });

      return acc;
    }, []);
  }
}

function getBasicScope(name: string): Scope {
  return {
    metadata: { name },
    spec: {
      filters: [],
      title: name,
      type: '',
      category: '',
      description: '',
    },
  };
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
export function getScopesAndTreeScopesWithPaths(
  selectedScopes: SelectedScope[],
  treeScopes: TreeScope[],
  path: string[],
  childNodes: ScopesNodesMap
): [SelectedScope[], TreeScope[]] {
  const childNodesArr = Object.values(childNodes);

  // Get all scopes without paths
  // We use tree scopes as the list is always up to date as opposed to selected scopes which can be outdated
  const scopeNamesWithoutPaths = treeScopes.filter(({ path }) => path.length === 0).map(({ scopeName }) => scopeName);

  // We search for the path of each scope name without a path
  const scopeNamesWithPaths = scopeNamesWithoutPaths.reduce<Record<string, string[]>>((acc, scopeName) => {
    const possibleParent = childNodesArr.find((childNode) => childNode.isSelectable && childNode.linkId === scopeName);

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
