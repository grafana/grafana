import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { Icon, Input, Toggletip, useStyles2 } from '@grafana/ui';

import { ScopesFiltersBaseSelectorScene } from './ScopesFiltersBaseSelectorScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';
import { fetchScope } from './api/scopes';
import { ScopesFiltersOpenAdvanced } from './events';

export class ScopesFiltersBasicSelectorScene extends ScopesFiltersBaseSelectorScene implements SceneObjectWithUrlSync {
  static Component = ScopesFiltersBasicSelectorSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  constructor() {
    super();

    this.toggleNodeSelect = this.toggleNodeSelect.bind(this);
    this.openAdvancedSelector = this.openAdvancedSelector.bind(this);
  }

  getUrlState() {
    return { scopes: this.state.scopes.map((scope) => scope.metadata.name) };
  }

  async updateFromUrl(values: SceneObjectUrlValues) {
    let scopesNames = values.scopes ?? [];
    scopesNames = Array.isArray(scopesNames) ? scopesNames : [scopesNames];

    if (scopesNames.length > 0) {
      let scopes = scopesNames.map(this.getBasicScope);

      // First set the basic scopes for display purposes
      // We don't emit the scopes update yet as we wait for the scopes to load properly
      // This avoids unnecessary re-renders
      this.setState({ scopes, isLoadingScopes: true });

      scopes = await Promise.all(scopesNames.map((scopeName) => fetchScope(scopeName)));

      // Then load the actual scopes
      this.setState({ scopes, isLoadingScopes: false });

      this.emitScopesUpdated();
    }
  }

  public async toggleNodeSelect(linkId: string, path: string[]) {
    await super.toggleNodeSelect(linkId, path);

    this.emitScopesUpdated();
  }

  public openAdvancedSelector() {
    this.publishEvent(
      new ScopesFiltersOpenAdvanced({
        nodes: this.state.nodes,
        expandedNodes: this.state.expandedNodes,
        scopes: this.state.scopes,
      }),
      true
    );

    this.close();
  }
}

export function ScopesFiltersBasicSelectorSceneRenderer({
  model,
}: SceneComponentProps<ScopesFiltersBasicSelectorScene>) {
  const styles = useStyles2(getStyles);
  const { nodes, expandedNodes, scopes, isOpened, isLoadingScopes, isLoadingNodes } = model.useState();
  const scopesTitles = useMemo(() => scopes.map(({ spec: { title } }) => title).join(', '), [scopes]);
  const isLoading = isLoadingNodes || isLoadingScopes;
  const isLoadingNotOpened = isLoading && !isOpened;

  return (
    <div className={styles.container}>
      <Toggletip
        show={isOpened}
        onClose={model.close}
        onOpen={model.open}
        content={
          <div className={styles.innerContainer}>
            <ScopesTreeLevel
              isLoadingNodes={isLoadingNodes}
              isLoadingScopes={isLoadingScopes}
              nodes={nodes}
              expandedNodes={expandedNodes}
              scopes={scopes}
              onNodeQuery={model.queryNode}
              onNodeExpandToggle={model.toggleNodeExpand}
              onNodeSelectToggle={model.toggleNodeSelect}
            />
          </div>
        }
        footer={
          <button className={styles.openAdvancedButton} disabled={isLoading} onClick={model.openAdvancedSelector}>
            Open advanced scope selector <Icon name="arrow-right" />
          </button>
        }
        closeButton={false}
      >
        <Input
          readOnly
          placeholder={isLoadingNotOpened ? 'Loading scopes...' : 'Select scopes...'}
          loading={isLoadingNotOpened}
          value={scopesTitles}
        />
      </Toggletip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',

      '& > div': css({
        padding: 0,

        '& > div': css({
          padding: 0,
          margin: 0,
        }),
      }),
    }),
    innerContainer: css({
      minWidth: 400,
      padding: theme.spacing(0, 1),
    }),
    openAdvancedButton: css({
      backgroundColor: theme.colors.secondary.main,
      border: 'none',
      borderTop: `1px solid ${theme.colors.secondary.border}`,
      display: 'block',
      fontSize: theme.typography.pxToRem(12),
      margin: 0,
      padding: theme.spacing(1.5),
      textAlign: 'right',
      width: '100%',
    }),
  };
};
