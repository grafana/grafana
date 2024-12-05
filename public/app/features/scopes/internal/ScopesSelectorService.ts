import { isEqual } from 'lodash';
import { BehaviorSubject, from, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { getScopesDashboardsService, getScopesService } from '../services';

import { fetchNodes, fetchScope, fetchSelectedScopes } from './api';
import { NodeReason, NodesMap, SelectedScope, TreeScope } from './types';
import { getBasicScope, getScopesAndTreeScopesWithPaths, getTreeScopesFromSelectedScopes } from './utils';

export interface State {
  isOpened: boolean;
  loadingNodeName: string | undefined;
  nodes: NodesMap;
  selectedScopes: SelectedScope[];
  treeScopes: TreeScope[];
}

const getInitialState = (): State => ({
  isOpened: false,
  loadingNodeName: undefined,
  nodes: {
    '': {
      name: '',
      reason: NodeReason.Result,
      nodeType: 'container',
      title: '',
      isExpandable: true,
      isSelectable: false,
      isExpanded: true,
      query: '',
      nodes: {},
    },
  },
  selectedScopes: [],
  treeScopes: [],
});

export class ScopesSelectorService {
  private _state = new BehaviorSubject(getInitialState());
  private prevState = getInitialState();

  private nodesFetchingSub: Subscription | undefined;

  public get state() {
    return this._state.getValue();
  }

  public get stateObservable() {
    return this._state.asObservable();
  }

  public updateNode = async (path: string[], isExpanded: boolean, query: string) => {
    this.nodesFetchingSub?.unsubscribe();

    let nodes = { ...this.state.nodes };
    let currentLevel: NodesMap = nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevel = currentLevel[path[idx]].nodes;
    }

    const loadingNodeName = path[path.length - 1];
    const currentNode = currentLevel[loadingNodeName];

    const isDifferentQuery = currentNode.query !== query;

    currentNode.isExpanded = isExpanded;
    currentNode.query = query;

    if (isExpanded || isDifferentQuery) {
      this.updateState({ nodes, loadingNodeName });

      this.nodesFetchingSub = from(fetchNodes(loadingNodeName, query))
        .pipe(
          finalize(() => {
            this.updateState({ loadingNodeName: undefined });
          })
        )
        .subscribe((childNodes) => {
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

          this.updateState({ nodes, selectedScopes, treeScopes });

          this.nodesFetchingSub?.unsubscribe();
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
      fetchScope(linkId!);

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

  public applyNewScopes = async (treeScopes = this.state.treeScopes) => {
    if (isEqual(treeScopes, getTreeScopesFromSelectedScopes(this.state.selectedScopes))) {
      return;
    }

    let selectedScopes = treeScopes.map(({ scopeName, path }) => ({ scope: getBasicScope(scopeName), path }));
    this.updateState({ selectedScopes, treeScopes });
    getScopesService()?.enterLoadingMode();
    getScopesDashboardsService()?.fetchDashboards(selectedScopes.map(({ scope }) => scope.metadata.name));

    selectedScopes = await fetchSelectedScopes(treeScopes);
    this.updateState({ selectedScopes });
    getScopesService()?.setScopes(selectedScopes.map(({ scope }) => scope));
    getScopesService()?.exitLoadingMode();
  };

  public dismissNewScopes = () => {
    this.updateState({ treeScopes: getTreeScopesFromSelectedScopes(this.state.selectedScopes) });
  };

  public removeAllScopes = () => {
    this.applyNewScopes([]);
  };

  public openPicker = async () => {
    if (!getScopesService()?.state.isReadOnly) {
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

      this.updateState({ nodes, isOpened: true });
    }
  };

  public closePicker = () => {
    this.updateState({ isOpened: false });
  };

  public subscribeToState = (cb: (newState: State, prevState: State) => void): Subscription => {
    return this._state.subscribe((newState) => cb(newState, this.prevState));
  };

  private closeNodes = (nodes: NodesMap): NodesMap => {
    return Object.entries(nodes).reduce<NodesMap>((acc, [id, node]) => {
      acc[id] = {
        ...node,
        isExpanded: false,
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
        isExpanded: true,
      };
      currentNodes = currentNodes[nodeId].nodes;
    }

    return nodes;
  };

  private updateState = (newState: Partial<State>) => {
    this.prevState = this.state;
    this._state.next({ ...this._state.getValue(), ...newState });
  };
}
