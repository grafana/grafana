import { isEqual } from 'lodash';
import { finalize, from } from 'rxjs';

import { Scope, ScopeNode } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';

import { ScopesService } from '../ScopesService';
import { ScopesServiceBase } from '../ScopesServiceBase';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import { NodeReason, NodesMap, SelectedScope, TreeScope } from './types';

interface ScopesSelectorServiceState {
  opened: boolean;
  loadingNodeName: string | undefined;
  nodes: NodesMap;
  selectedScopes: SelectedScope[];
  treeScopes: TreeScope[];
}

export class ScopesSelectorService extends ScopesServiceBase<ScopesSelectorServiceState> {
  static #instance: ScopesSelectorService | undefined = undefined;

  private _scopesCache = new Map<string, Promise<Scope>>();

  private constructor() {
    super({
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

  public static get instance(): ScopesSelectorService | undefined {
    if (!ScopesSelectorService.#instance && config.featureToggles.scopeFilters) {
      ScopesSelectorService.#instance = new ScopesSelectorService();
    }

    return ScopesSelectorService.#instance;
  }

  public updateNode = async (path: string[], expanded: boolean, query: string) => {
    this._fetchSub?.unsubscribe();

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

      this._fetchSub = from(this.fetchNodeApi(loadingNodeName, query))
        .pipe(
          finalize(() => {
            this.updateState({ loadingNodeName: undefined });
          })
        )
        .subscribe((childNodes) => {
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

          this.updateState({ nodes, selectedScopes, treeScopes });

          this._fetchSub?.unsubscribe();
        });
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
  };

  public changeScopes = (scopeNames: string[]) =>
    this.setNewScopes(scopeNames.map((scopeName) => ({ scopeName, path: [] })));

  public setNewScopes = async (treeScopes = this.state.treeScopes) => {
    if (isEqual(treeScopes, this.getTreeScopesFromSelectedScopes(this.state.selectedScopes))) {
      return;
    }

    let selectedScopes = treeScopes.map(({ scopeName, path }) => ({
      scope: this.getBasicScope(scopeName),
      path,
    }));
    this.updateState({ selectedScopes, treeScopes });
    ScopesService.instance?.setLoading(true);
    ScopesDashboardsService.instance?.fetchDashboards(selectedScopes.map(({ scope }) => scope.metadata.name));

    selectedScopes = await this.fetchScopesApi(treeScopes);
    this.updateState({ selectedScopes });
    ScopesService.instance?.setScopes(selectedScopes.map(({ scope }) => scope));
    ScopesService.instance?.setLoading(false);
  };

  public removeAllScopes = () => this.setNewScopes([]);

  public open = async () => {
    if (!ScopesService.instance?.state.readOnly) {
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
      nodes = this.expandNodes(nodes, path);

      this.updateState({ nodes, opened: true });
    }
  };

  public closeAndReset = () => {
    this.updateState({ opened: false, treeScopes: this.getTreeScopesFromSelectedScopes(this.state.selectedScopes) });
  };

  public closeAndApply = () => {
    this.updateState({ opened: false });
    this.setNewScopes();
  };

  public toggleDrawer = () => ScopesService.instance?.setDrawerOpened(!ScopesService.instance?.state.drawerOpened);

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

  private expandNodes = (nodes: NodesMap, path: string[]): NodesMap => {
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
  };

  private getBasicScope = (name: string): Scope => {
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

  public fetchNodeApi = async (parent: string, query: string): Promise<NodesMap> => {
    try {
      const nodes =
        (
          await getBackendSrv().get<{ items: ScopeNode[] }>(
            `/apis/${this._apiGroup}/${this._apiVersion}/namespaces/${this._apiNamespace}/find/scope_node_children`,
            { parent, query }
          )
        )?.items ?? [];

      return nodes.reduce<NodesMap>((acc, { metadata: { name }, spec }) => {
        acc[name] = {
          name,
          ...spec,
          expandable: spec.nodeType === 'container',
          selectable: spec.linkType === 'scope',
          expanded: false,
          query: '',
          reason: NodeReason.Result,
          nodes: {},
        };
        return acc;
      }, {});
    } catch (err) {
      return {};
    }
  };

  public fetchScopeApi = async (name: string): Promise<Scope> => {
    if (this._scopesCache.has(name)) {
      return this._scopesCache.get(name)!;
    }

    const response = new Promise<Scope>(async (resolve) => {
      const basicScope = this.getBasicScope(name);

      try {
        const serverScope = await getBackendSrv().get<Scope>(
          `/apis/${this._apiGroup}/${this._apiVersion}/namespaces/${this._apiNamespace}/scopes/${name}`
        );

        const scope = {
          ...basicScope,
          ...serverScope,
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
        this._scopesCache.delete(name);

        resolve(basicScope);
      }
    });

    this._scopesCache.set(name, response);

    return response;
  };

  public fetchScopesApi = async (treeScopes: TreeScope[]): Promise<SelectedScope[]> => {
    const scopes = await Promise.all(treeScopes.map(({ scopeName }) => this.fetchScopeApi(scopeName)));

    return scopes.reduce<SelectedScope[]>((acc, scope, idx) => {
      acc.push({
        scope,
        path: treeScopes[idx].path,
      });

      return acc;
    }, []);
  };

  public reset = () => {
    ScopesSelectorService.#instance = undefined;
  };
}
