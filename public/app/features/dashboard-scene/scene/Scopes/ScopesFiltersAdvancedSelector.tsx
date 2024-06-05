import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Drawer, Spinner, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export function ScopesFiltersAdvancedSelector({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const { nodes, loadingNodeName, dirtyScopeNames, isLoadingScopes, isAdvancedOpened } = model.useState();

  if (!isAdvancedOpened) {
    return null;
  }

  return (
    <Drawer
      title={t('scopes.advancedSelector.title', 'Select scopes')}
      size="sm"
      onClose={() => {
        model.closeAdvancedSelector();
        model.resetDirtyScopeNames();
      }}
    >
      {isLoadingScopes ? (
        <Spinner data-testid="scopes-advanced-loading" />
      ) : (
        <ScopesTreeLevel
          showQuery={true}
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
          data-testid="scopes-advanced-apply"
          onClick={() => {
            model.closeAdvancedSelector();
            model.updateScopes();
          }}
        >
          <Trans i18nKey="scopes.advancedSelector.apply">Apply</Trans>
        </Button>
        <Button
          variant="secondary"
          data-testid="scopes-advanced-cancel"
          onClick={() => {
            model.closeAdvancedSelector();
            model.resetDirtyScopeNames();
          }}
        >
          <Trans i18nKey="scopes.advancedSelector.cancel">Cancel</Trans>
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
