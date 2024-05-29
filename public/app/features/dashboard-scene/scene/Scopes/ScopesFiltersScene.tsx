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

import { ScopesFiltersAdvancedSelector } from './ScopesFiltersAdvancedSelectorScene';
import { ScopesFiltersBasicSelector } from './ScopesFiltersBasicSelectorScene';
import { fetchNodes, fetchScope } from './api/scopes';
import { Node, NodesMap } from './types';

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: Record<string, Node>;
  loadingNodeId: string | undefined;
  scopes: Scope[];
  isLoadingScopes: boolean;
  isBasicOpened: boolean;
  isAdvancedOpened: boolean;
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
      isBasicOpened: false,
      isAdvancedOpened: false,
    });

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
    this.setState({ isBasicOpened: false, isAdvancedOpened: true });
  }

  public getScopesNames(scopes: Scope[]): string[] {
    return scopes.map(({ metadata: { name } }) => name);
  }

  public getNewScopeNames(path: string[], scopeNames: string[]): string[] {
    scopeNames = [...scopeNames];

    let siblings = this.state.nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      siblings = siblings[path[idx]].nodes;
    }

    const nodeId = path[path.length - 1];
    const {
      item: { linkId },
    } = siblings[nodeId];

    const selectedIdx = scopeNames.findIndex((scopeName) => scopeName === linkId);

    if (selectedIdx === -1) {
      fetchScope(linkId!);

      const selectedFromSameNode =
        scopeNames.length === 0 || Object.values(siblings).some((node) => node.item.linkId === scopeNames[0]);

      return !selectedFromSameNode ? [linkId!] : [...scopeNames, linkId!];
    } else {
      scopeNames.splice(selectedIdx, 1);

      return scopeNames;
    }
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
