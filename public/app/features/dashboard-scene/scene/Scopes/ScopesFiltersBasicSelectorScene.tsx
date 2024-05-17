import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { Icon, Input, Toggletip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';

import { ScopesFiltersBaseSelectorScene } from './ScopesFiltersBaseSelectorScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';
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

  updateFromUrl(values: SceneObjectUrlValues) {
    let scopesNames = values.scopes ?? [];
    scopesNames = Array.isArray(scopesNames) ? scopesNames : [scopesNames];

    Promise.all(scopesNames.map((scopeName) => this.fetchScope(scopeName))).then((scopes) => this.setState({ scopes }));
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
  const { nodes, expandedNodes, scopes, isOpened } = model.useState();
  const parentState = model.parent?.useState() ?? {};
  const isViewing = 'isViewing' in parentState ? !!parentState.isViewing : false;

  return (
    <div className={styles.container}>
      <Toggletip
        show={isOpened}
        onClose={model.close}
        onOpen={model.open}
        content={
          <div className={styles.innerContainer}>
            <ScopesTreeLevel
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
          <button className={styles.openAdvancedButton} onClick={model.openAdvancedSelector}>
            Open advanced scope selector <Icon name="arrow-right" />
          </button>
        }
        closeButton={false}
      >
        <Input
          disabled={isViewing}
          readOnly
          placeholder="Select scopes..."
          value={scopes.map((scope) => scope.spec.title)}
        />
      </Toggletip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
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
