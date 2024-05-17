import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Drawer } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export function ScopesFiltersSceneAdvancedRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const state = model.useState();
  const { nodes, expandedNodes, scopes } = state;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const parent = model.parent as ScopesScene;

  const handleDrawerClose = (save: boolean) => parent.closeAdvancedSelector(save ? state : undefined);
  const handleNodeExpandToggle = (path: string[]) => model.toggleNodeExpand(path);
  const handleScopeSelectToggle = (linkId: string, parentNodeId: string) =>
    model.toggleScopeSelect(linkId, parentNodeId);

  return (
    <Drawer title="Select scopes" size="sm" onClose={() => handleDrawerClose(false)}>
      <ScopesTreeLevel
        isExpanded
        path={[]}
        nodes={nodes}
        expandedNodes={expandedNodes}
        scopes={scopes}
        onNodeExpandToggle={handleNodeExpandToggle}
        onScopeSelectToggle={handleScopeSelectToggle}
      />

      <div className={styles.buttonGroup}>
        <Button variant="primary" onClick={() => handleDrawerClose(true)}>
          Apply
        </Button>

        <Button variant="secondary" onClick={() => handleDrawerClose(false)}>
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
