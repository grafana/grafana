import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import React from 'react';
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
import { Button, Drawer, IconButton, Input, Spinner, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesScene } from './ScopesScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';
import { fetchNodes, fetchScope, fetchScopes } from './api';
import { NodesMap } from './types';

export interface ScopesFiltersSceneState extends SceneObjectState {
  nodes: NodesMap;
  loadingNodeName: string | undefined;
  scopes: Scope[];
  dirtyScopeNames: string[];
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
      dirtyScopeNames: [],
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

  public open() {
    if (!this.scopesParent.state.isViewing) {
      this.setState({ isOpened: true });
    }
  }

  public close() {
    this.setState({ isOpened: false });
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
    this.setState({ isOpened: false });
  }

  private getScopeNames(): string[] {
    return this.state.scopes.map(({ metadata: { name } }) => name);
  }
}

export function ScopesFiltersSceneRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const { nodes, loadingNodeName, dirtyScopeNames, isLoadingScopes, isOpened, scopes } = model.useState();
  const { isViewing } = model.scopesParent.useState();

  const scopesTitles = scopes.map(({ spec: { title } }) => title).join(', ');

  return (
    <>
      <Input
        readOnly
        placeholder={t('scopes.filters.input.placeholder', 'Select scopes...')}
        loading={isLoadingScopes}
        value={scopesTitles}
        aria-label={t('scopes.filters.input.placeholder', 'Select scopes...')}
        data-testid="scopes-filters-input"
        suffix={
          scopes.length > 0 && !isViewing ? (
            <IconButton
              aria-label={t('scopes.filters.input.removeAll', 'Remove all scopes')}
              name="times"
              onClick={() => model.removeAllScopes()}
            />
          ) : undefined
        }
        onClick={() => model.open()}
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
              scopeNames={dirtyScopeNames}
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
