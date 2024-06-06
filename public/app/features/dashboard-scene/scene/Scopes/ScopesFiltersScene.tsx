import { isEqual } from 'lodash';
import React from 'react';

import { Scope } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';

import { ScopesFiltersAdvancedSelector } from './ScopesFiltersAdvancedSelector';
import { ScopesFiltersBasicSelector } from './ScopesFiltersBasicSelector';
import { ScopesScene } from './ScopesScene';
import { fetchNodes, fetchScope, fetchScopes } from './api';
import { NodesMap } from './types';

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: NodesMap;
  loadingNodeName: string | undefined;
  scopes: Scope[];
  dirtyScopeNames: string[];
  isLoadingScopes: boolean;
  isBasicOpened: boolean;
  isAdvancedOpened: boolean;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> implements SceneObjectWithUrlSync {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  get scopesParent(): ScopesScene {
    return sceneGraph.getAncestor(this, ScopesScene);
  }

  constructor() {
    super({
      nodes: {
        '': {
          name: '',
          nodeType: 'container',
          title: '',
          isExpandable: true,
          isSelectable: false,
          isExpanded: true,
          query: '',
          nodes: {},
        },
      },
      loadingNodeName: undefined,
      scopes: [],
      dirtyScopeNames: [],
      isLoadingScopes: false,
      isBasicOpened: false,
      isAdvancedOpened: false,
    });

    this.addActivationHandler(() => {
      this.fetchBaseNodes();
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

  public async updateNode(path: string[], isExpanded: boolean, query: string) {
    let nodes = { ...this.state.nodes };
    let currentLevel: NodesMap = nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevel = currentLevel[path[idx]].nodes;
    }

    const name = path[path.length - 1];
    const currentNode = currentLevel[name];

    if (isExpanded || currentNode.query !== query) {
      this.setState({ loadingNodeName: name });

      currentNode.nodes = await fetchNodes(name, query);
    }

    currentNode.isExpanded = isExpanded;
    currentNode.query = query;

    this.setState({ nodes, loadingNodeName: undefined });
  }

  public toggleNodeSelect(path: string[]) {
    let dirtyScopeNames = [...this.state.dirtyScopeNames];

    let siblings = this.state.nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      siblings = siblings[path[idx]].nodes;
    }

    const name = path[path.length - 1];
    const { linkId } = siblings[name];

    const selectedIdx = dirtyScopeNames.findIndex((scopeName) => scopeName === linkId);

    if (selectedIdx === -1) {
      fetchScope(linkId!);

      const selectedFromSameNode =
        dirtyScopeNames.length === 0 || Object.values(siblings).some(({ linkId }) => linkId === dirtyScopeNames[0]);

      this.setState({ dirtyScopeNames: !selectedFromSameNode ? [linkId!] : [...dirtyScopeNames, linkId!] });
    } else {
      dirtyScopeNames.splice(selectedIdx, 1);

      this.setState({ dirtyScopeNames });
    }
  }

  public openBasicSelector() {
    if (!this.scopesParent.state.isViewing) {
      this.setState({ isBasicOpened: true, isAdvancedOpened: false });
    }
  }

  public closeBasicSelector() {
    this.setState({ isBasicOpened: false });
  }

  public openAdvancedSelector() {
    if (!this.scopesParent.state.isViewing) {
      this.setState({ isBasicOpened: false, isAdvancedOpened: true });
    }
  }

  public closeAdvancedSelector() {
    this.setState({ isAdvancedOpened: false });
  }

  public getSelectedScopes(): Scope[] {
    return this.state.scopes;
  }

  public async updateScopes(dirtyScopeNames = this.state.dirtyScopeNames) {
    if (isEqual(dirtyScopeNames, this.getScopeNames())) {
      return;
    }

    this.setState({ dirtyScopeNames, isLoadingScopes: true });

    this.setState({ scopes: await fetchScopes(dirtyScopeNames), isLoadingScopes: false });
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
