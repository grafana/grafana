import React from 'react';

import { AppEvents, Scope, ScopeSpec, ScopeTreeItemSpec } from '@grafana/data';
import { getAppEvents, getBackendSrv } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { ScopedResourceServer } from 'app/features/apiserver/server';

import { ScopesFiltersSceneAdvancedRenderer } from './ScopesFiltersSceneAdvancedRenderer';
import { ScopesFiltersSceneBasicRenderer } from './ScopesFiltersSceneBasicRenderer';

export interface Node {
  item: ScopeTreeItemSpec;
  hasChildren: boolean;
  isSelectable: boolean;
  children: Record<string, Node>;
}

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: Record<string, Node>;
  expandedNodes: string[];
  selectedFromNode: string;
  scopes: Scope[];
  isOpened: boolean;
  isAdvanced: boolean;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  private serverGroup = 'scope.grafana.app';
  private serverVersion = 'v0alpha1';
  private serverNamespace = 'default';

  private server = new ScopedResourceServer<ScopeSpec, 'Scope'>({
    group: this.serverGroup,
    version: this.serverVersion,
    resource: 'scopes',
  });

  constructor() {
    super({
      nodes: {},
      expandedNodes: [],
      selectedFromNode: '',
      scopes: [],
      isOpened: false,
      isAdvanced: false,
    });
  }

  getUrlState() {
    if (this.state.isAdvanced) {
      return {};
    }

    return { scopes: this.state.scopes.map((scope) => scope.metadata.name) };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    let scopesNames = values.scopes ?? [];
    scopesNames = Array.isArray(scopesNames) ? scopesNames : [scopesNames];

    const scopesPromises = scopesNames.map((scopeName) => this.server.get(scopeName));

    Promise.all(scopesPromises).then((scopes) => {
      this.setState({
        scopes: scopesNames.map((scopeName, scopeNameIdx) =>
          this.mergeScopeNameWithScope(scopeName, scopes[scopeNameIdx] ?? {})
        ),
      });
    });
  }

  public async fetchTreeItems(nodeId: string, query: string): Promise<Record<string, Node>> {
    try {
      return (
        (
          await getBackendSrv().get<{ items: ScopeTreeItemSpec[] }>(
            `/apis/${this.serverGroup}/${this.serverVersion}/namespaces/${this.serverNamespace}/find`,
            { parent: nodeId, query }
          )
        )?.items ?? []
      ).reduce<Record<string, Node>>((acc, item) => {
        acc[item.nodeId] = {
          item,
          hasChildren: item.nodeType === 'container',
          isSelectable: item.linkType === 'scope',
          children: {},
        };

        return acc;
      }, {});
    } catch (err) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to fetch tree items'],
      });

      return {};
    }
  }

  public async fetchScopes(parent: string) {
    try {
      return (await this.server.list({ labelSelector: [{ key: 'category', operator: '=', value: parent }] }))?.items;
    } catch (err) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to fetch scopes'],
      });
      return [];
    }
  }

  public async toggleNodeExpand(path: string[]) {
    const isExpanded = this.state.expandedNodes.includes(path[path.length - 1]);

    if (isExpanded) {
      path.splice(path.length - 1, 1);

      return this.setState({ expandedNodes: path });
    }

    this.setState({
      nodes: await this.getNewNodes(path, ''),
      expandedNodes: path,
    });
  }

  public async queryNode(path: string[], query: string) {
    this.setState({
      nodes: await this.getNewNodes(path, query),
    });
  }

  public async fetchBaseNodes() {
    this.setState({
      nodes: await this.fetchTreeItems('', ''),
      expandedNodes: [],
    });
  }

  public async toggleScopeSelect(linkId: string, parentNodeId: string) {
    let scopes = [...this.state.scopes];
    const selectedIdx = scopes.findIndex((scope) => scope.metadata.name === linkId);
    let selectedFromNode = this.state.selectedFromNode;

    if (selectedIdx === -1) {
      const receivedScope = await this.server.get(linkId);
      const scope = this.mergeScopeNameWithScope(linkId, receivedScope ?? {});

      if (selectedFromNode !== parentNodeId) {
        scopes = [scope];
        selectedFromNode = parentNodeId;
      } else {
        scopes.push(scope);
      }

      scopes.push();
    } else {
      scopes.splice(selectedIdx, 1);
    }

    this.setState({ scopes, selectedFromNode });
  }

  public openBasicSelector() {
    this.setState({ isOpened: true });
  }

  public closeBasicSelector() {
    this.setState({ isOpened: false });
  }

  private async getNewNodes(path: string[], query: string): Promise<Record<string, Node>> {
    let nodes = { ...this.state.nodes };
    let currentLevel = nodes;

    for (let idx = 0; idx < path.length; idx++) {
      const nodeId = path[idx];
      const isLast = idx === path.length - 1;
      const currentNode = currentLevel[nodeId];

      currentLevel[nodeId] = {
        ...currentNode,
        children: isLast ? await this.fetchTreeItems(nodeId, query) : currentLevel[nodeId].children,
      };

      currentLevel = currentNode.children;
    }

    return nodes;
  }

  private mergeScopeNameWithScope(scopeName: string, scope: Partial<Scope>): Scope {
    return {
      ...scope,
      metadata: {
        name: scopeName,
        ...scope.metadata,
      },
      spec: {
        filters: [],
        title: scopeName,
        type: '',
        category: '',
        description: '',
        ...scope.spec,
      },
    };
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const { isAdvanced } = model.useState();

  if (isAdvanced) {
    return <ScopesFiltersSceneAdvancedRenderer model={model} />;
  }

  return <ScopesFiltersSceneBasicRenderer model={model} />;
}
