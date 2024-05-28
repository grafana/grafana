import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Drawer, useStyles2 } from '@grafana/ui';

import { ScopesFiltersBaseSelectorScene } from './ScopesFiltersBaseSelectorScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';
import { ScopesFiltersSaveAdvanced, ScopesUpdate } from './events';

export class ScopesFiltersAdvancedSelectorScene extends ScopesFiltersBaseSelectorScene {
  static Component = ScopesFiltersAdvancedSelectorSceneRenderer;

  constructor() {
    super();

    this.save = this.save.bind(this);
  }

  public save() {
    this.publishEvent(
      new ScopesFiltersSaveAdvanced({
        nodes: this.state.nodes,
        expandedNodes: this.state.expandedNodes,
        scopes: this.state.scopes,
      }),
      true
    );

    this.publishEvent(new ScopesUpdate(this.state.scopes));

    this.close();
  }
}

export function ScopesFiltersAdvancedSelectorSceneRenderer({
  model,
}: SceneComponentProps<ScopesFiltersAdvancedSelectorScene>) {
  const styles = useStyles2(getStyles);
  const state = model.useState();
  const { nodes, expandedNodes, scopes, isOpened, isLoadingNodes, isLoadingScopes } = state;
  const isLoading = isLoadingNodes || isLoadingScopes;

  if (!isOpened) {
    return null;
  }

  return (
    <Drawer title="Select scopes" size="sm" onClose={model.close}>
      <ScopesTreeLevel
        isLoadingNodes={isLoadingNodes}
        isLoadingScopes={isLoadingScopes}
        showQuery
        nodes={nodes}
        expandedNodes={expandedNodes}
        scopes={scopes}
        onNodeQuery={model.queryNode}
        onNodeExpandToggle={model.toggleNodeExpand}
        onNodeSelectToggle={model.toggleNodeSelect}
      />
      <div className={styles.buttonGroup}>
        <Button variant="primary" disabled={isLoading} onClick={model.save}>
          Apply
        </Button>
        <Button variant="secondary" onClick={model.close}>
          Cancel
        </Button>
      </div>
    </Drawer>
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
