import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { finalize, from, Subscription } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Button, Drawer, IconButton, Spinner, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t, Trans } from 'app/core/internationalization';

import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesInput } from './ScopesInput';
import { ScopesTree } from './ScopesTree';
import { fetchNodes, fetchScope, fetchSelectedScopes } from './api';
import { NodeReason, NodesMap, SelectedScope, TreeScope } from './types';
import { getBasicScope, getScopesAndTreeScopesWithPaths, getTreeScopesFromSelectedScopes } from './utils';

export interface ScopesSelectorSceneState extends SceneObjectState {
  dashboards: SceneObjectRef<ScopesDashboardsScene> | null;
  nodes: NodesMap;
  loadingNodeName: string | undefined;
  scopes: SelectedScope[];
  treeScopes: TreeScope[];
  isReadOnly: boolean;
  isLoadingScopes: boolean;
  isPickerOpened: boolean;
  isEnabled: boolean;
}

export const initialSelectorState: Omit<ScopesSelectorSceneState, 'dashboards'> = {
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
  loadingNodeName: undefined,
  scopes: [],
  treeScopes: [],
  isReadOnly: false,
  isLoadingScopes: false,
  isPickerOpened: false,
  isEnabled: false,
};

export class ScopesSelectorScene extends SceneObjectBase<ScopesSelectorSceneState> {
  static Component = ScopesSelectorSceneRenderer;

  private nodesFetchingSub: Subscription | undefined;

  constructor() {
    super({
      dashboards: null,
      ...initialSelectorState,
    });

    this.addActivationHandler(() => {
      // Only fetch base nodes on activation when there are no nodes fetched
      // This prevents an issue where base nodes are overwritten upon re-activations
      if (Object.keys(this.state.nodes[''].nodes).length === 0) {
        this.fetchBaseNodes();
      }

      return () => {
        this.nodesFetchingSub?.unsubscribe();
      };
    });
  }

  public fetchBaseNodes() {
    return this.updateNode([''], true, '');
  }

  public async updateNode(path: string[], isExpanded: boolean, query: string) {
    this.nodesFetchingSub?.unsubscribe();

    let nodes = { ...this.state.nodes };
    let currentLevel: NodesMap = nodes;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevel = currentLevel[path[idx]].nodes;
    }

    const name = path[path.length - 1];
    const currentNode = currentLevel[name];

    const isDifferentQuery = currentNode.query !== query;

    currentNode.isExpanded = isExpanded;
    currentNode.query = query;

    if (isExpanded || isDifferentQuery) {
      this.setState({ nodes, loadingNodeName: name });

      this.nodesFetchingSub = from(fetchNodes(name, query))
        .pipe(
          finalize(() => {
            this.setState({ loadingNodeName: undefined });
          })
        )
        .subscribe((childNodes) => {
          const [scopes, treeScopes] = getScopesAndTreeScopesWithPaths(
            this.state.scopes,
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

          this.setState({ nodes, scopes, treeScopes });

          this.nodesFetchingSub?.unsubscribe();
        });
    } else {
      this.setState({ nodes, loadingNodeName: undefined });
    }
  }

  public toggleNodeSelect(path: string[]) {
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

      this.setState({
        treeScopes: parentNode?.disableMultiSelect || !selectedFromSameNode ? [treeScope] : [...treeScopes, treeScope],
      });
    } else {
      treeScopes.splice(selectedIdx, 1);

      this.setState({ treeScopes });
    }
  }

  public openPicker() {
    if (!this.state.isReadOnly) {
      let nodes = { ...this.state.nodes };

      // First close all nodes
      nodes = this.closeNodes(nodes);

      // Extract the path of a scope
      let path = [...(this.state.scopes[0]?.path ?? ['', ''])];
      path.splice(path.length - 1, 1);

      // Expand the nodes to the selected scope
      nodes = this.expandNodes(nodes, path);

      this.setState({ isPickerOpened: true, nodes });
    }
  }

  public closePicker() {
    this.setState({ isPickerOpened: false });
  }

  public async updateScopes(treeScopes = this.state.treeScopes) {
    if (isEqual(treeScopes, getTreeScopesFromSelectedScopes(this.state.scopes))) {
      return;
    }

    this.setState({
      // Update the scopes with the basic scopes otherwise they'd be lost between URL syncs
      scopes: treeScopes.map(({ scopeName, path }) => ({ scope: getBasicScope(scopeName), path })),
      treeScopes,
      isLoadingScopes: true,
    });

    this.state.dashboards?.resolve().fetchDashboards(treeScopes.map(({ scopeName }) => scopeName));

    const scopes = await fetchSelectedScopes(treeScopes);

    this.setState({ scopes, isLoadingScopes: false });
  }

  public resetDirtyScopeNames() {
    this.setState({ treeScopes: getTreeScopesFromSelectedScopes(this.state.scopes) });
  }

  public async removeAllScopes() {
    return this.updateScopes([]);
  }

  public enterReadOnly() {
    this.setState({ isReadOnly: true, isPickerOpened: false });
  }

  public exitReadOnly() {
    this.setState({ isReadOnly: false });
  }

  public enable() {
    this.setState({ isEnabled: true });
  }

  public disable() {
    this.setState({ isEnabled: false });
  }

  private closeNodes(nodes: NodesMap): NodesMap {
    return Object.entries(nodes).reduce<NodesMap>((acc, [id, node]) => {
      acc[id] = {
        ...node,
        isExpanded: false,
        nodes: this.closeNodes(node.nodes),
      };

      return acc;
    }, {});
  }

  private expandNodes(nodes: NodesMap, path: string[]): NodesMap {
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
  }
}

export function ScopesSelectorSceneRenderer({ model }: SceneComponentProps<ScopesSelectorScene>) {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const styles = useStyles2(getStyles, menuDockedAndOpen);
  const {
    dashboards: dashboardsRef,
    nodes,
    loadingNodeName,
    scopes,
    treeScopes,
    isReadOnly,
    isLoadingScopes,
    isPickerOpened,
    isEnabled,
  } = model.useState();

  const dashboards = dashboardsRef?.resolve();

  const { isPanelOpened: isDashboardsPanelOpened } = dashboards?.useState() ?? {};

  if (!isEnabled) {
    return null;
  }

  const dashboardsIconLabel = isReadOnly
    ? t('scopes.dashboards.toggle.disabled', 'Suggested dashboards list is disabled due to read only mode')
    : isDashboardsPanelOpened
      ? t('scopes.dashboards.toggle.collapse', 'Collapse suggested dashboards list')
      : t('scopes.dashboards.toggle..expand', 'Expand suggested dashboards list');

  return (
    <div className={styles.container}>
      <IconButton
        name="web-section-alt"
        className={styles.dashboards}
        aria-label={dashboardsIconLabel}
        tooltip={dashboardsIconLabel}
        data-testid="scopes-dashboards-expand"
        disabled={isReadOnly}
        onClick={() => dashboards?.togglePanel()}
      />

      <ScopesInput
        nodes={nodes}
        scopes={scopes}
        isDisabled={isReadOnly}
        isLoading={isLoadingScopes}
        onInputClick={() => model.openPicker()}
        onRemoveAllClick={() => model.removeAllScopes()}
      />

      {isPickerOpened && (
        <Drawer
          title={t('scopes.selector.title', 'Select scopes')}
          size="sm"
          onClose={() => {
            model.closePicker();
            model.resetDirtyScopeNames();
          }}
        >
          <div className={styles.drawerContainer}>
            <div className={styles.treeContainer}>
              {isLoadingScopes ? (
                <Spinner data-testid="scopes-selector-loading" />
              ) : (
                <ScopesTree
                  nodes={nodes}
                  nodePath={['']}
                  loadingNodeName={loadingNodeName}
                  scopes={treeScopes}
                  onNodeUpdate={(path, isExpanded, query) => model.updateNode(path, isExpanded, query)}
                  onNodeSelectToggle={(path) => model.toggleNodeSelect(path)}
                />
              )}
            </div>

            <div className={styles.buttonsContainer}>
              <Button
                variant="primary"
                data-testid="scopes-selector-apply"
                onClick={() => {
                  model.closePicker();
                  model.updateScopes();
                }}
              >
                <Trans i18nKey="scopes.selector.apply">Apply</Trans>
              </Button>
              <Button
                variant="secondary"
                data-testid="scopes-selector-cancel"
                onClick={() => {
                  model.closePicker();
                  model.resetDirtyScopeNames();
                }}
              >
                <Trans i18nKey="scopes.selector.cancel">Cancel</Trans>
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, menuDockedAndOpen: boolean) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'row',
      paddingLeft: menuDockedAndOpen ? theme.spacing(2) : 'unset',
    }),
    dashboards: css({
      color: theme.colors.text.secondary,
      marginRight: theme.spacing(2),

      '&:hover': css({
        color: theme.colors.text.primary,
      }),
    }),
    drawerContainer: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }),
    treeContainer: css({
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100%',
      overflowY: 'hidden',
      // Fix for top level search outline overflow due to scrollbars
      paddingLeft: theme.spacing(0.5),
    }),
    buttonsContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      marginTop: theme.spacing(8),
    }),
  };
};
