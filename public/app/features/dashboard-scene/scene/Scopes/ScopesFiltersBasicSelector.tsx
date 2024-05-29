import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Icon, Input, Spinner, Toggletip, useStyles2 } from '@grafana/ui';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export function ScopesFiltersBasicSelector({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const {
    nodes: { '': basicNode },
    loadingNodeId,
    scopes,
    isLoadingScopes,
    isBasicOpened,
  } = model.useState();

  const [scopeNames, setScopeNames] = useState(model.getScopesNames(scopes));

  useEffect(() => {
    setScopeNames(model.getScopesNames(scopes));
  }, [model, scopes]);

  const { nodes, query } = basicNode;
  const scopesTitles = useMemo(() => scopes.map(({ spec: { title } }) => title).join(', '), [scopes]);

  return (
    <div className={styles.container}>
      <Toggletip
        show={isBasicOpened}
        onClose={() => {
          model.closeBasicSelector();
          model.updateScopes(scopeNames);
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
                isExpanded={true}
                query={query}
                path={['']}
                loadingNodeId={loadingNodeId}
                scopeNames={scopeNames}
                onNodeUpdate={(path, isExpanded, query) => model.updateNode(path, isExpanded, query)}
                onNodeSelectToggle={(path) => setScopeNames(model.getNewScopeNames(path, scopeNames))}
              />
            )}
          </div>
        }
        footer={
          <button className={styles.openAdvancedButton} onClick={() => model.openAdvancedSelector()}>
            Open advanced scope selector <Icon name="arrow-right" />
          </button>
        }
        closeButton={false}
      >
        <Input readOnly placeholder="Select scopes..." loading={isLoadingScopes} value={scopesTitles} />
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
