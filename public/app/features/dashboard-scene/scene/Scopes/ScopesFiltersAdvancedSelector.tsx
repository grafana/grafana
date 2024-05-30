import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Drawer, Spinner, useStyles2 } from '@grafana/ui';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export function ScopesFiltersAdvancedSelector({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const {
    nodes: { '': basicNode },
    loadingNodeId,
    scopes,
    isLoadingScopes,
    isAdvancedOpened,
  } = model.useState();

  const [scopeNames, setScopeNames] = useState(model.getScopesNames(scopes));

  useEffect(() => {
    setScopeNames(model.getScopesNames(scopes));
  }, [model, scopes]);

  const { nodes, query } = basicNode;

  if (!isAdvancedOpened) {
    return null;
  }

  return (
    <Drawer title="Select scopes" size="sm" onClose={() => model.closeAdvancedSelector()}>
      {isLoadingScopes ? (
        <Spinner />
      ) : (
        <ScopesTreeLevel
          showQuery={true}
          nodes={Object.values(nodes)}
          query={query}
          path={['']}
          loadingNodeId={loadingNodeId}
          scopeNames={scopeNames}
          onNodeUpdate={(path, isExpanded, query) => model.updateNode(path, isExpanded, query)}
          onNodeSelectToggle={(path) => setScopeNames(model.getNewScopeNames(path, scopeNames))}
        />
      )}
      <div className={styles.buttonGroup}>
        <Button
          variant="primary"
          onClick={() => {
            model.closeAdvancedSelector();
            model.updateScopes(scopeNames);
          }}
        >
          Apply
        </Button>
        <Button variant="secondary" onClick={() => model.closeAdvancedSelector()}>
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
