import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Drawer, useStyles2 } from '@grafana/ui';

import { ScopesFiltersBaseSelectorScene } from './ScopesFiltersBaseSelectorScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export class ScopesFiltersAdvancedSelectorScene extends ScopesFiltersBaseSelectorScene {
  static Component = ScopesFiltersAdvancedSelectorSceneRenderer;
}

export function ScopesFiltersAdvancedSelectorSceneRenderer({
  model,
}: SceneComponentProps<ScopesFiltersAdvancedSelectorScene>) {
  const styles = useStyles2(getStyles);
  const { isOpened, scopeNames } = model.useState();
  const { nodes, loadingNodeId, isLoadingScopes } = model.filtersParent.useState();
  const basicNode = nodes[''];
  const isLoading = !!loadingNodeId || isLoadingScopes;

  if (!isOpened) {
    return null;
  }

  return (
    <Drawer title="Select scopes" size="sm" onClose={model.close}>
      <ScopesTreeLevel
        showQuery={false}
        nodes={basicNode.nodes}
        isExpanded={true}
        query={basicNode.query}
        path={['']}
        loadingNodeId={loadingNodeId}
        scopeNames={scopeNames}
        isLoadingScopes={isLoadingScopes}
        onNodeUpdate={model.filtersParent.updateNode}
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
