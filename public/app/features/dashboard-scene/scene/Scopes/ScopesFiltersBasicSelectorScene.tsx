import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Icon, Input, Toggletip, useStyles2 } from '@grafana/ui';

import { ScopesFiltersBaseSelectorScene } from './ScopesFiltersBaseSelectorScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export class ScopesFiltersBasicSelectorScene extends ScopesFiltersBaseSelectorScene {
  static Component = ScopesFiltersBasicSelectorSceneRenderer;
}

export function ScopesFiltersBasicSelectorSceneRenderer({
  model,
}: SceneComponentProps<ScopesFiltersBasicSelectorScene>) {
  const styles = useStyles2(getStyles);
  const { isOpened, scopeNames } = model.useState();
  const { nodes, loadingNodeId, scopes, isLoadingScopes } = model.filtersParent.useState();
  const basicNode = nodes[''];
  const scopesTitles = useMemo(() => scopes.map(({ spec: { title } }) => title).join(', '), [scopes]);
  const isLoading = !!loadingNodeId || isLoadingScopes;
  const isLoadingNotOpened = isLoading && !isOpened;

  return (
    <div className={styles.container}>
      <Toggletip
        show={isOpened}
        onClose={model.save}
        onOpen={model.open}
        content={
          <div className={styles.innerContainer}>
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
          </div>
        }
        footer={
          <button
            className={styles.openAdvancedButton}
            disabled={isLoading}
            onClick={model.filtersParent.openAdvancedSelector}
          >
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
