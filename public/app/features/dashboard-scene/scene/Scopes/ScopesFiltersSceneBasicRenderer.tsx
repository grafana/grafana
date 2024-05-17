import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Icon, Input, Toggletip, useStyles2 } from '@grafana/ui';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';
import { ScopesTreeLevel } from './ScopesTreeLevel';

export function ScopesFiltersSceneBasicRenderer({ model }: SceneComponentProps<ScopesFiltersScene>) {
  const styles = useStyles2(getStyles);
  const { nodes, expandedNodes, scopes, isOpened } = model.useState();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const parent = model.parent as ScopesScene;
  const { isViewing } = parent.useState();

  const handleOpenBasicSelector = () => model.openBasicSelector();
  const handleCloseBasicSelector = () => model.closeBasicSelector();
  const handleNodeExpandToggle = (path: string[]) => model.toggleNodeExpand(path);
  const handleScopeSelectToggle = (linkId: string, parentNodeId: string) =>
    model.toggleScopeSelect(linkId, parentNodeId);
  const handleOpenAdvancedSelector = () => parent.openAdvancedSelector();

  return (
    <div className={styles.container}>
      <Toggletip
        show={isOpened}
        onClose={handleCloseBasicSelector}
        onOpen={handleOpenBasicSelector}
        content={
          <div className={styles.innerContainer}>
            <ScopesTreeLevel
              isExpanded
              path={[]}
              nodes={nodes}
              expandedNodes={expandedNodes}
              scopes={scopes}
              onNodeExpandToggle={handleNodeExpandToggle}
              onScopeSelectToggle={handleScopeSelectToggle}
            />
          </div>
        }
        footer={
          <button className={styles.openAdvancedButton} onClick={handleOpenAdvancedSelector}>
            Open advanced scope selector <Icon name="arrow-right" />
          </button>
        }
        closeButton={false}
      >
        <Input disabled={isViewing} readOnly value={scopes.map((scope) => scope.spec.title)} />
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
