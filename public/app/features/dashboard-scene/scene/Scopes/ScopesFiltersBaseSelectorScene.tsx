import { Scope } from '@grafana/data';
import { sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { ScopesScene } from './ScopesScene';
import { fetchScope, fetchScopeTreeItems, getBasicScope } from './api/scopes';
import { ScopesUpdate } from './events';
import { ExpandedNode } from './types';

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
      let scope = getBasicScope(linkId);

      let siblings = this.state.nodes;

      for (let idx = 1; idx < path.length - 1; idx++) {
        siblings = siblings[path[idx]].children;
      }

      const selectedFromSameNode =
        initialScopes.length === 0 ||
        Object.values(siblings).some((node) => node.item.linkId === initialScopes[0].metadata.name);

      let scopes = !selectedFromSameNode ? [scope] : [...initialScopes, scope];

      this.setState({ scopes, isLoadingScopes: true });

      scope = await fetchScope(linkId);
      scopes = !selectedFromSameNode ? [scope] : [...initialScopes, scope];

      this.setState({ scopes, isLoadingScopes: false });
    } else {
      initialScopes.splice(selectedIdx, 1);

      this.setState({ scopes: initialScopes });
    }
  }

  protected emitScopesUpdated() {
    this.publishEvent(new ScopesUpdate(this.state.scopes), true);
  }

  private async fetchNodes(parent: string, query: string): Promise<Record<string, Node>> {
    return (await fetchScopeTreeItems(parent, query)).reduce<Record<string, Node>>((acc, item) => {
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
