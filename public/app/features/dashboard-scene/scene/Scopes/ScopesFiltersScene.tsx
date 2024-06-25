import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { finalize, from, Subscription } from 'rxjs';

import { GrafanaTheme2, Scope } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { Button, Drawer, Spinner, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesInput } from './ScopesInput';
import { ScopesScene } from './ScopesScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';
import { fetchNodes, fetchScope, fetchSelectedScopes } from './api';
import { NodesMap, SelectedScope, TreeScope } from './types';
import { getBasicScope } from './utils';

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: NodesMap;
  loadingNodeName: string | undefined;
  scopes: SelectedScope[];
  treeScopes: TreeScope[];
  isLoadingScopes: boolean;
  isOpened: boolean;
}

export class ScopesFiltersScene extends SceneObjectBase<ScopesFiltersSceneState> implements SceneObjectWithUrlSync {
  static Component = ScopesFiltersSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  private nodesFetchingSub: Subscription | undefined;

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
      treeScopes: [],
      isLoadingScopes: false,
      isOpened: false,
    });

    this.addActivationHandler(() => {
      this.fetchBaseNodes();

      return () => {
        this.nodesFetchingSub?.unsubscribe();
      };
    });
  }

  public getUrlState() {
    return {
      scopes: this.state.scopes.map(({ scope }) => scope.metadata.name),
    };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    let scopeNames = values.scopes ?? [];
    scopeNames = Array.isArray(scopeNames) ? scopeNames : [scopeNames];

    this.updateScopes(scopeNames.map((scopeName) => ({ scopeName, path: [] })));
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

    this.setState({ nodes, loadingNodeName: undefined });

    if (isExpanded || isDifferentQuery) {
      this.setState({ loadingNodeName: name });

      this.nodesFetchingSub = from(fetchNodes(name, query))
        .pipe(
          finalize(() => {
            this.setState({ loadingNodeName: undefined });
          })
        )
        .subscribe((childNodes) => {
          currentNode.nodes = childNodes;

          this.setState({ nodes });

          this.nodesFetchingSub?.unsubscribe();
        });
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

  public open() {
    if (!this.scopesParent.state.isViewing) {
      this.setState({ isOpened: true });
    }
  }

  public close() {
    this.setState({ isOpened: false });
  }

  public getSelectedScopes(): Scope[] {
    return this.state.scopes.map(({ scope }) => scope);
  }

  public async updateScopes(treeScopes = this.state.treeScopes) {
    if (isEqual(treeScopes, this.getTreeScopes())) {
      return;
    }

    this.setState({
      // Update the scopes with the basic scopes otherwise they'd be lost between URL syncs
      scopes: treeScopes.map(({ scopeName, path }) => ({ scope: getBasicScope(scopeName), path })),
      treeScopes,
      isLoadingScopes: true,
    });

    const scopes = await fetchSelectedScopes(treeScopes);

    this.setState({ scopes, isLoadingScopes: false });
  }

  public resetDirtyScopeNames() {
    this.setState({ treeScopes: this.getTreeScopes() });
  }

  public removeAllScopes() {
    this.setState({ scopes: [], treeScopes: [], isLoadingScopes: false });
  }

  public enterViewMode() {
    this.setState({ isOpened: false });
  }

  private getTreeScopes(): TreeScope[] {
    return this.state.scopes.map(({ scope, path }) => ({
      scopeName: scope.metadata.name,
      path,
    }));
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const { nodes, loadingNodeName, treeScopes, isLoadingScopes, isOpened, scopes } = model.useState();
  const { isViewing } = model.scopesParent.useState();

  return (
    <>
      <ScopesInput
        nodes={nodes}
        scopes={scopes}
        isDisabled={isViewing}
        isLoading={isLoadingScopes}
        onInputClick={() => model.open()}
        onRemoveAllClick={() => model.removeAllScopes()}
      />

      {isOpened && (
        <Drawer
          title={t('scopes.filters.title', 'Select scopes')}
          size="sm"
          onClose={() => {
            model.close();
            model.resetDirtyScopeNames();
          }}
        >
          {isLoadingScopes ? (
            <Spinner data-testid="scopes-filters-loading" />
          ) : (
            <ScopesTreeLevel
              nodes={nodes}
              nodePath={['']}
              loadingNodeName={loadingNodeName}
              scopes={treeScopes}
              onNodeUpdate={(path, isExpanded, query) => model.updateNode(path, isExpanded, query)}
              onNodeSelectToggle={(path) => model.toggleNodeSelect(path)}
            />
          )}
          <div className={styles.buttonGroup}>
            <Button
              variant="primary"
              data-testid="scopes-filters-apply"
              onClick={() => {
                model.close();
                model.updateScopes();
              }}
            >
              <Trans i18nKey="scopes.filters.apply">Apply</Trans>
            </Button>
            <Button
              variant="secondary"
              data-testid="scopes-filters-cancel"
              onClick={() => {
                model.close();
                model.resetDirtyScopeNames();
              }}
            >
              <Trans i18nKey="scopes.filters.cancel">Cancel</Trans>
            </Button>
          </div>
        </Drawer>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonGroup: css({
      display: 'flex',
      gap: theme.spacing(1),
      marginTop: theme.spacing(8),
    }),
  };
};
