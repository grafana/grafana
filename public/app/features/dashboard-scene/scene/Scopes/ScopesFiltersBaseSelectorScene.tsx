import { AppEvents, Scope, ScopeSpec, ScopeTreeItemSpec } from '@grafana/data';
import { config, getAppEvents, getBackendSrv } from '@grafana/runtime';
import { sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ScopedResourceServer } from 'app/features/apiserver/server';

import { ScopesScene } from './ScopesScene';
import { ScopesUpdate } from './events';

export interface Node {
  item: ScopeTreeItemSpec;
  hasChildren: boolean;
  isSelectable: boolean;
  children: Record<string, Node>;
}

export interface ExpandedNode {
  nodeId: string;
  query: string;
}

export interface ScopesFiltersBaseSelectorSceneState extends SceneObjectState {
  nodes: Record<string, Node>;
  expandedNodes: ExpandedNode[];
  scopes: Scope[];
  isOpened: boolean;
  isLoadingScopes: boolean;
  isLoadingNodes: boolean;
}

const baseExpandedNode: ExpandedNode = {
  nodeId: '',
  query: '',
};

export abstract class ScopesFiltersBaseSelectorScene extends SceneObjectBase<ScopesFiltersBaseSelectorSceneState> {
  private readonly serverGroup = 'scope.grafana.app';
  private readonly serverVersion = 'v0alpha1';
  private readonly serverNamespace = config.namespace ?? 'default';

  protected readonly server = new ScopedResourceServer<ScopeSpec, 'Scope'>({
    group: this.serverGroup,
    version: this.serverVersion,
    resource: 'scopes',
  });

  protected constructor(state: Partial<ScopesFiltersBaseSelectorSceneState> = {}) {
    super({
      nodes: {},
      expandedNodes: [baseExpandedNode],
      scopes: [],
      isOpened: false,
      isLoadingScopes: false,
      isLoadingNodes: false,
      ...state,
    });

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.queryNode = this.queryNode.bind(this);
    this.toggleNodeExpand = this.toggleNodeExpand.bind(this);
    this.toggleNodeSelect = this.toggleNodeSelect.bind(this);
  }

  public open() {
    if (
      !sceneGraph.getAncestor(this, ScopesScene)?.state.isViewing &&
      !this.state.isLoadingScopes &&
      !this.state.isLoadingNodes
    ) {
      this.setState({ isOpened: true });
    }
  }

  public close() {
    this.setState({ isOpened: false });
  }

  public async fetchBaseNodes() {
    this.setState({ isLoadingNodes: true });

    const nodes = await this.fetchNodes('', '');

    this.setState({
      nodes,
      expandedNodes: [baseExpandedNode],
      isLoadingNodes: false,
    });
  }

  public async queryNode(nodeId: string, query: string) {
    this.setState({ isLoadingNodes: true });

    const expandedNodes = [...this.state.expandedNodes];
    const expandedNodeIdx = expandedNodes.findIndex((expandedNode) => expandedNode.nodeId === nodeId);
    expandedNodes[expandedNodeIdx] = { nodeId, query };

    const nodes = await this.getNodesMap(expandedNodes);

    this.setState({
      nodes,
      expandedNodes,
      isLoadingNodes: false,
    });
  }

  public async toggleNodeExpand(nodeId: string) {
    const expandedNodes = [...this.state.expandedNodes];
    const expandedNodeIdx = expandedNodes.findIndex((expandedNode) => expandedNode.nodeId === nodeId);
    const isExpanded = expandedNodeIdx > -1;

    if (isExpanded) {
      expandedNodes.splice(expandedNodeIdx);

      return this.setState({ expandedNodes });
    }

    expandedNodes.push({
      nodeId,
      query: '',
    });

    this.setState({ expandedNodes, isLoadingNodes: true });

    const nodes = await this.getNodesMap(expandedNodes);

    this.setState({
      nodes,
      isLoadingNodes: false,
    });
  }

  public async toggleNodeSelect(linkId: string, path: string[]) {
    const initialScopes = [...this.state.scopes];
    const selectedIdx = initialScopes.findIndex((scope) => scope.metadata.name === linkId);

    if (selectedIdx === -1) {
      let scope = this.getBasicScope(linkId);

      let siblings = this.state.nodes;

      for (let idx = 1; idx < path.length - 1; idx++) {
        siblings = siblings[path[idx]].children;
      }

      const selectedFromSameNode =
        initialScopes.length === 0 ||
        Object.values(siblings).some((node) => node.item.linkId === initialScopes[0].metadata.name);

      let scopes = !selectedFromSameNode ? [scope] : [...initialScopes, scope];

      this.setState({ scopes, isLoadingScopes: true });

      scope = await this.fetchScope(linkId);
      scopes = !selectedFromSameNode ? [scope] : [...initialScopes, scope];

      this.setState({ scopes, isLoadingScopes: false });
    } else {
      initialScopes.splice(selectedIdx, 1);

      this.setState({ scopes: initialScopes });
    }
  }

  public getBasicScope(name: string): Scope {
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

  public async fetchScope(name: string): Promise<Scope> {
    const basicScope: Scope = this.getBasicScope(name);

    try {
      const scope = await this.server.get(name);

      return {
        ...basicScope,
        metadata: {
          ...basicScope,
          ...scope.metadata,
        },
        spec: {
          ...basicScope,
          ...scope.spec,
        },
      };
    } catch (err) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to fetch scope'],
      });

      return basicScope;
    }
  }

  protected emitScopesUpdated() {
    this.publishEvent(new ScopesUpdate(this.state.scopes), true);
  }

  private async fetchScopeTreeItem(parent: string, query: string): Promise<ScopeTreeItemSpec[]> {
    try {
      return (
        (
          await getBackendSrv().get<{ items: ScopeTreeItemSpec[] }>(
            `/apis/${this.serverGroup}/${this.serverVersion}/namespaces/${this.serverNamespace}/find`,
            { parent, query }
          )
        )?.items ?? []
      );
    } catch (err) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to fetch nodes'],
      });

      return [];
    }
  }

  private async fetchNodes(parent: string, query: string): Promise<Record<string, Node>> {
    return (await this.fetchScopeTreeItem(parent, query)).reduce<Record<string, Node>>((acc, item) => {
      acc[item.nodeId] = {
        item,
        hasChildren: item.nodeType === 'container',
        isSelectable: item.linkType === 'scope',
        children: {},
      };
      return acc;
    }, {});
  }

  private async getNodesMap(path: ExpandedNode[]): Promise<Record<string, Node>> {
    let nodes = { ...this.state.nodes };
    let currentLevel = nodes;

    for (let idx = 0; idx < path.length; idx++) {
      const { nodeId, query } = path[idx];
      const isLast = idx === path.length - 1;
      const currentNode = currentLevel[nodeId];

      if (!nodeId) {
        nodes = isLast ? await this.fetchNodes(nodeId, query) : nodes;
        currentLevel = nodes;
      } else {
        currentLevel[nodeId] = {
          ...currentNode,
          children: isLast ? await this.fetchNodes(nodeId, query) : currentLevel[nodeId].children,
        };

        currentLevel = currentNode.children;
      }
    }

    return nodes;
  }
}
