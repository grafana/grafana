import { isEqual } from 'lodash';
import React from 'react';

import { Scope } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';

import { ScopesFiltersAdvancedSelectorScene } from './ScopesFiltersAdvancedSelectorScene';
import { ScopesFiltersBasicSelectorScene } from './ScopesFiltersBasicSelectorScene';
import { fetchNodes, fetchScope } from './api/scopes';
import { Node, NodesMap } from './types';

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: Record<string, Node>;
  loadingNodeId: string | undefined;
  scopes: Scope[];
  isLoadingScopes: boolean;

  basicSelector: ScopesFiltersBasicSelectorScene;
  advancedSelector: ScopesFiltersAdvancedSelectorScene;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> implements SceneObjectWithUrlSync {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

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
      isLoadingScopes: false,

      basicSelector: new ScopesFiltersBasicSelectorScene(),
      advancedSelector: new ScopesFiltersAdvancedSelectorScene(),
    });

    this.updateNode = this.updateNode.bind(this);
    this.openAdvancedSelector = this.openAdvancedSelector.bind(this);

    this.addActivationHandler(() => {
      this.fetchBaseNodes();
    });
  }

  public getUrlState() {
    return { scopes: this.state.scopes.map((scope) => scope.metadata.name) };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    let scopesNames = values.scopes ?? [];
    scopesNames = Array.isArray(scopesNames) ? scopesNames : [scopesNames];

    this.updateScopes(scopesNames);
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

    const nodeId = path[path.length - 1];
    const currentNode = currentLevel[nodeId];

    if (isExpanded || currentNode.query !== query) {
      this.setState({ loadingNodeId: nodeId });

      currentNode.nodes = await fetchNodes(nodeId, query);
    }

    currentNode.isExpanded = isExpanded;
    currentNode.query = query;

    this.setState({ nodes, loadingNodeId: undefined });
  }

  public openAdvancedSelector() {
    this.state.basicSelector.close();
    this.state.advancedSelector.open();
  }

  public getSelectedScopes(): Scope[] {
    return this.state.scopes;
  }

  public async updateScopes(scopeNames: string[]) {
    if (
      isEqual(
        scopeNames,
        this.state.scopes.map(({ metadata: { name } }) => name)
      )
    ) {
      return;
    }

    this.setState({ isLoadingScopes: true });

    const scopes = await Promise.all(scopeNames.map(fetchScope));

    this.setState({ scopes, isLoadingScopes: false });
  }

  public enterViewMode() {
    this.state.basicSelector.close();
    this.state.advancedSelector.close();
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const { basicSelector, advancedSelector } = model.useState();

  return (
    <>
      <basicSelector.Component model={basicSelector} />
      <advancedSelector.Component model={advancedSelector} />
    </>
  );
}
