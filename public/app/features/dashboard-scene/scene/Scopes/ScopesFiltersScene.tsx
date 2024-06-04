import { isEqual } from 'lodash';
import React from 'react';
import { from, Subscription } from 'rxjs';

import { Scope } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';

import { ScopesFiltersAdvancedSelector } from './ScopesFiltersAdvancedSelector';
import { ScopesFiltersBasicSelector } from './ScopesFiltersBasicSelector';
import { fetchNodes, fetchScope, fetchScopes } from './api/scopes';
import { Node, NodesMap } from './types';

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: Record<string, Node>;
  loadingNodeId: string | undefined;
  scopes: Scope[];
  dirtyScopeNames: string[];
  isLoadingScopes: boolean;
  isBasicOpened: boolean;
  isAdvancedOpened: boolean;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> implements SceneObjectWithUrlSync {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  private fetchNodesSub: Subscription | undefined;
  private fetchScopesSub: Subscription | undefined;

  constructor() {
    super({
      nodes: {
        '': {
          item: { nodeId: '', nodeType: 'container', title: '' },
          isExpandable: true,
          isSelectable: false,
          isExpanded: true,
          query: '',
          nodes: {},
        },
      },
      loadingNodeId: undefined,
      scopes: [],
      dirtyScopeNames: [],
      isLoadingScopes: false,
      isBasicOpened: false,
      isAdvancedOpened: false,
    });

    this.addActivationHandler(() => {
      this.fetchBaseNodes();

      return () => {
        this.fetchNodesSub?.unsubscribe();
        this.fetchScopesSub?.unsubscribe();
      };
    });
  }

  public getUrlState() {
    return { scopes: this.getScopeNames() };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    let dirtyScopeNames = values.scopes ?? [];
    dirtyScopeNames = Array.isArray(dirtyScopeNames) ? dirtyScopeNames : [dirtyScopeNames];

    this.updateScopes(dirtyScopeNames);
  }

  public fetchBaseNodes() {
    return this.updateNode([''], true, '');
  }

  public updateNode(path: string[], isExpanded: boolean, query: string) {
    let nodes = { ...this.state.nodes };
    let currentLevel: NodesMap = nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevel = currentLevel[path[idx]].nodes;
    }

    const nodeId = path[path.length - 1];
    const currentNode = currentLevel[nodeId];

    if (isExpanded || currentNode.query !== query) {
      this.fetchNodesSub?.unsubscribe();

      this.setState({ loadingNodeId: nodeId });

      this.fetchNodesSub = from(fetchNodes(nodeId, query)).subscribe((childNodes) => {
        currentNode.nodes = childNodes;
        currentNode.isExpanded = isExpanded;
        currentNode.query = query;

        this.fetchNodesSub?.unsubscribe();

        this.setState({
          nodes,
          loadingNodeId: undefined,
        });
      });

      return;
    }

    currentNode.isExpanded = isExpanded;
    currentNode.query = query;

    this.setState({ nodes, loadingNodeId: undefined });
  }

  public toggleNodeSelect(path: string[]) {
    let dirtyScopeNames = [...this.state.dirtyScopeNames];

    let siblings = this.state.nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      siblings = siblings[path[idx]].nodes;
    }

    const nodeId = path[path.length - 1];
    const {
      item: { linkId },
    } = siblings[nodeId];

    const selectedIdx = dirtyScopeNames.findIndex((scopeName) => scopeName === linkId);

    if (selectedIdx === -1) {
      fetchScope(linkId!);

      const selectedFromSameNode =
        dirtyScopeNames.length === 0 ||
        Object.values(siblings).some(({ item: { linkId } }) => linkId === dirtyScopeNames[0]);

      this.setState({ dirtyScopeNames: !selectedFromSameNode ? [linkId!] : [...dirtyScopeNames, linkId!] });
    } else {
      dirtyScopeNames.splice(selectedIdx, 1);

      this.setState({ dirtyScopeNames });
    }
  }

  public openBasicSelector() {
    this.setState({ isBasicOpened: true, isAdvancedOpened: false });
  }

  public closeBasicSelector() {
    this.setState({ isBasicOpened: false });
  }

  public openAdvancedSelector() {
    this.setState({ isBasicOpened: false, isAdvancedOpened: true });
  }

  public closeAdvancedSelector() {
    this.setState({ isAdvancedOpened: false });
  }

  public getSelectedScopes(): Scope[] {
    return this.state.scopes;
  }

  public updateScopes(dirtyScopeNames = this.state.dirtyScopeNames) {
    if (isEqual(dirtyScopeNames, this.getScopeNames())) {
      return;
    }

    this.fetchScopesSub?.unsubscribe();

    this.setState({ dirtyScopeNames, isLoadingScopes: true });

    this.fetchScopesSub = from(fetchScopes(dirtyScopeNames)).subscribe((scopes) => {
      this.fetchScopesSub?.unsubscribe();

      this.setState({ scopes, isLoadingScopes: false });
    });
  }

  public resetDirtyScopeNames() {
    this.setState({ dirtyScopeNames: this.getScopeNames() });
  }

  public removeAllScopes() {
    this.setState({ scopes: [], dirtyScopeNames: [], isLoadingScopes: false });
  }

  public enterViewMode() {
    this.setState({ isBasicOpened: false, isAdvancedOpened: false });
  }

  private getScopeNames(): string[] {
    return this.state.scopes.map(({ metadata: { name } }) => name);
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  return (
    <>
      <ScopesFiltersBasicSelector model={model} />
      <ScopesFiltersAdvancedSelector model={model} />
    </>
  );
}
