import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Icon, IconButton, Input, Spinner, Toggletip, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export function ScopesFiltersBasicSelector({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const { nodes, loadingNodeId, scopes, dirtyScopeNames, isLoadingScopes, isBasicOpened } = model.useState();

  const scopesTitles = scopes.map(({ spec: { title } }) => title).join(', ');

  return (
    <div className={styles.container}>
      <Toggletip
        show={isBasicOpened}
        onClose={() => {
          model.closeBasicSelector();
          model.updateScopes();
        }}
        onOpen={() => model.openBasicSelector()}
        content={
          <div className={styles.innerContainer}>
            {isLoadingScopes ? (
              <Spinner />
            ) : (
              <ScopesTreeLevel
                showQuery={false}
                nodes={nodes}
                nodePath={['']}
                loadingNodeId={loadingNodeId}
                scopeNames={dirtyScopeNames}
                onNodeUpdate={(path, isExpanded, query) => model.updateNode(path, isExpanded, query)}
                onNodeSelectToggle={(path) => model.toggleNodeSelect(path)}
              />
            )}
          </div>
        }
        footer={
          <button className={styles.openAdvancedButton} onClick={() => model.openAdvancedSelector()}>
            <Trans i18nKey="scopes.basicSelector.openAdvanced">
              Open advanced scope selector <Icon name="arrow-right" />
            </Trans>
          </button>
        }
        closeButton={false}
      >
        <Input
          readOnly
          placeholder=""
          aria-label={t('scopes.basicSelector.placeholder', 'Select scopes...')}
          loading={isLoadingScopes}
          suffix={
            scopes.length > 0 ? (
              <IconButton
                aria-label={t('scopes.basicSelector.removeAll', 'Remove all scopes')}
                name="times"
                onClick={() => model.removeAllScopes()}
              />
            ) : undefined
          }
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
