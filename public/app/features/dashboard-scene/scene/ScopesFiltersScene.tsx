import { css, cx } from '@emotion/css';
import React from 'react';

import { AppEvents, GrafanaTheme2, Scope, ScopeSpec, ScopeTreeItemSpec } from '@grafana/data';
import { getAppEvents, getBackendSrv } from '@grafana/runtime';
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
  isScope: boolean;
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
  private serverNamespace = 'default';

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
    let scopes = values.scopes ?? [];
    scopes = Array.isArray(scopes) ? scopes : [scopes];

    const scopesPromises = scopes.map((scopeName) => this.server.get(scopeName));

    Promise.all(scopesPromises).then((scopes) => {
      this.setState({ scopes });
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
          isScope: item.nodeType === 'leaf',
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

  public async expandNode(path: string[]) {
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

  public async toggleScope(linkId: string) {
    let scopes = this.state.scopes;
    const selectedIdx = scopes.findIndex((scope) => scope.metadata.name === linkId);

    if (selectedIdx === -1) {
      const scope = await this.server.get(linkId);

      if (scope) {
        scopes = [...scopes, scope];
      }
    } else {
      scopes.splice(selectedIdx, 1);
    }

    this.setState({ scopes });
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const { nodes, expandedNodes, scopes } = model.useState();
  const parentState = model.parent!.useState();
  const isViewing = 'isViewing' in parentState ? !!parentState.isViewing : false;

  const handleNodeExpand = (path: string[]) => model.expandNode(path);
  const handleScopeToggle = (linkId: string) => model.toggleScope(linkId);

  return (
    <Toggletip
      content={
        <ScopesTreeLevel
          isExpanded
          path={[]}
          nodes={nodes}
          expandedNodes={expandedNodes}
          scopes={scopes}
          onNodeExpand={handleNodeExpand}
          onScopeToggle={handleScopeToggle}
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
  onNodeExpand: (path: string[]) => void;
  onScopeToggle: (linkId: string) => void;
}

export function ScopesTreeLevel({
  isExpanded,
  path,
  nodes,
  expandedNodes,
  scopes,
  onNodeExpand,
  onScopeToggle,
}: ScopesTreeLevelProps) {
  const styles = useStyles2(getStyles);

  if (!isExpanded) {
    return null;
  }

  return (
    <div role="tree" className={path.length > 0 ? styles.innerLevelContainer : undefined}>
      {Object.values(nodes).map((node) => {
        const {
          item: { nodeId, linkId },
          isScope,
          children,
        } = node;
        const nodePath = [...path, nodeId];
        const isExpanded = expandedNodes.includes(nodeId);
        const isSelected = isScope && !!scopes.find((scope) => scope.metadata.name === linkId);

        return (
          <div
            key={nodeId}
            role="treeitem"
            aria-selected={isExpanded}
            tabIndex={0}
            className={cx(styles.item, isScope && styles.itemScope)}
            onClick={(evt) => {
              evt.stopPropagation();
              onNodeExpand(nodePath);
            }}
            onKeyDown={(evt) => {
              evt.stopPropagation();
              onNodeExpand(nodePath);
            }}
          >
            {!isScope ? (
              <Icon className={styles.icon} name="folder" />
            ) : (
              <Checkbox
                className={styles.checkbox}
                checked={isSelected}
                onChange={(evt) => {
                  evt.stopPropagation();

                  if (linkId) {
                    onScopeToggle(linkId);
                  }
                }}
              />
            )}

            <span>{node.item.title}</span>

            <ScopesTreeLevel
              isExpanded={isExpanded}
              path={nodePath}
              nodes={children}
              expandedNodes={expandedNodes}
              scopes={scopes}
              onNodeExpand={onNodeExpand}
              onScopeToggle={onScopeToggle}
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
