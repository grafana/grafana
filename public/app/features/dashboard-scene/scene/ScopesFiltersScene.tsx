import { css, cx } from '@emotion/css';
import React from 'react';

import { AppEvents, GrafanaTheme2, Scope, ScopeSpec, ScopeTreeItemSpec } from '@grafana/data';
import { config, getAppEvents, getBackendSrv } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Checkbox, Icon, Input, Toggletip, useStyles2 } from '@grafana/ui';
import { ScopedResourceClient } from 'app/features/apiserver/client';

export interface Node {
  item: ScopeTreeItemSpec;
  hasChildren: boolean;
  isSelectable: boolean;
  children: Record<string, Node>;
}

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: Record<string, Node>;
  expandedNodes: string[];
  scopes: Scope[];
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  private serverGroup = 'scope.grafana.app';
  private serverVersion = 'v0alpha1';
  private serverNamespace = config.namespace;

  private server = new ScopedResourceClient<ScopeSpec, 'Scope'>({
    group: this.serverGroup,
    version: this.serverVersion,
    resource: 'scopes',
  });

  constructor() {
    super({
      nodes: {},
      expandedNodes: [],
      scopes: [],
    });
  }

  getUrlState() {
    return { scopes: this.state.scopes.map((scope) => scope.metadata.name) };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    let scopesNames = values.scopes ?? [];
    scopesNames = Array.isArray(scopesNames) ? scopesNames : [scopesNames];

    const scopesPromises = scopesNames.map((scopeName) => this.server.get(scopeName));

    Promise.all(scopesPromises).then((scopes) => {
      this.setState({
        scopes: scopesNames.map((scopeName, scopeNameIdx) =>
          this.mergeScopeNameWithScopes(scopeName, scopes[scopeNameIdx] ?? {})
        ),
      });
    });
  }

  public async fetchTreeItems(nodeId: string): Promise<Record<string, Node>> {
    try {
      return (
        (
          await getBackendSrv().get<{ items: ScopeTreeItemSpec[] }>(
            `/apis/${this.serverGroup}/${this.serverVersion}/namespaces/${this.serverNamespace}/find`,
            { parent: nodeId }
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

    let nodes = { ...this.state.nodes };
    let currentLevel = nodes;

    for (let idx = 0; idx < path.length; idx++) {
      const nodeId = path[idx];
      const isLast = idx === path.length - 1;
      const currentNode = currentLevel[nodeId];

      currentLevel[nodeId] = {
        ...currentNode,
        children: isLast ? await this.fetchTreeItems(nodeId) : currentLevel[nodeId].children,
      };

      currentLevel = currentNode.children;
    }

    this.setState({
      nodes,
      expandedNodes: path,
    });
  }

  public async fetchBaseNodes() {
    this.setState({
      nodes: await this.fetchTreeItems(''),
      expandedNodes: [],
    });
  }

  public async toggleScopeSelect(linkId: string) {
    let scopes = [...this.state.scopes];
    const selectedIdx = scopes.findIndex((scope) => scope.metadata.name === linkId);

    if (selectedIdx === -1) {
      const receivedScope = await this.server.get(linkId);

      scopes.push(this.mergeScopeNameWithScopes(linkId, receivedScope ?? {}));
    } else {
      scopes.splice(selectedIdx, 1);
    }

    this.setState({ scopes });
  }

  private mergeScopeNameWithScopes(scopeName: string, scope: Partial<Scope>): Scope {
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
  const { nodes, expandedNodes, scopes } = model.useState();
  const parentState = model.parent!.useState();
  const isViewing = 'isViewing' in parentState ? !!parentState.isViewing : false;

  const handleNodeExpandToggle = (path: string[]) => model.toggleNodeExpand(path);
  const handleScopeSelectToggle = (linkId: string) => model.toggleScopeSelect(linkId);

  return (
    <Toggletip
      content={
        <ScopesTreeLevel
          isExpanded
          path={[]}
          nodes={nodes}
          expandedNodes={expandedNodes}
          scopes={scopes}
          onNodeExpandToggle={handleNodeExpandToggle}
          onScopeSelectToggle={handleScopeSelectToggle}
        />
      }
      footer={'Open advanced scope selector'}
      closeButton={false}
    >
      <Input disabled={isViewing} readOnly value={scopes.map((scope) => scope.spec.title)} />
    </Toggletip>
  );
}

export interface ScopesTreeLevelProps {
  isExpanded: boolean;
  path: string[];
  nodes: Record<string, Node>;
  expandedNodes: string[];
  scopes: Scope[];
  onNodeExpandToggle: (path: string[]) => void;
  onScopeSelectToggle: (linkId: string) => void;
}

export function ScopesTreeLevel({
  isExpanded,
  path,
  nodes,
  expandedNodes,
  scopes,
  onNodeExpandToggle,
  onScopeSelectToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  if (!isExpanded) {
    return null;
  }

  const anyChildExpanded = Object.values(nodes).some((node) => expandedNodes.includes(node.item.nodeId));

  return (
    <div role="tree" className={path.length > 0 ? styles.innerLevelContainer : undefined}>
      {Object.values(nodes).map((node) => {
        const {
          item: { nodeId, linkId },
          isSelectable,
          hasChildren,
          children,
        } = node;

        const isExpanded = expandedNodes.includes(nodeId);

        if (anyChildExpanded && !isExpanded) {
          return null;
        }

        const nodePath = [...path, nodeId];
        const isSelected = isSelectable && !!scopes.find((scope) => scope.metadata.name === linkId);

        return (
          <div
            key={nodeId}
            role="treeitem"
            aria-selected={isExpanded}
            tabIndex={0}
            className={cx(styles.item, isSelectable && styles.itemScope)}
            onClick={(evt) => {
              evt.stopPropagation();
              onNodeExpandToggle(nodePath);
            }}
            onKeyDown={(evt) => {
              evt.stopPropagation();
              onNodeExpandToggle(nodePath);
            }}
          >
            {isSelectable && (
              <Checkbox
                className={styles.checkbox}
                checked={isSelected}
                onChange={(evt) => {
                  evt.stopPropagation();
                  if (linkId) {
                    onScopeSelectToggle(linkId);
                  }
                }}
              />
            )}

            {hasChildren && <Icon className={styles.icon} name={isExpanded ? 'folder-open' : 'folder'} />}

            <span>{node.item.title}</span>

            <ScopesTreeLevel
              isExpanded={isExpanded}
              path={nodePath}
              nodes={children}
              expandedNodes={expandedNodes}
              scopes={scopes}
              onNodeExpandToggle={onNodeExpandToggle}
              onScopeSelectToggle={onScopeSelectToggle}
            />
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    innerLevelContainer: css({
      marginLeft: theme.spacing(2),
    }),
    item: css({
      cursor: 'pointer',
      margin: theme.spacing(1, 0),
    }),
    itemScope: css({
      cursor: 'default',
    }),
    icon: css({
      marginRight: theme.spacing(1),
    }),
    checkbox: css({
      marginRight: theme.spacing(1),
    }),
  };
};
