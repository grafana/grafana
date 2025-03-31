import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getDefaultVizPanel, useDashboardState } from '../../utils/utils';
import { addNewRowTo, addNewTabTo } from '../layouts-shared/addNew';

import { AutoGridLayout, AutoGridLayoutState } from './ResponsiveGridLayout';
import { AutoGridLayoutManager } from './ResponsiveGridLayoutManager';

export function AutoGridLayoutRenderer({ model }: SceneComponentProps<AutoGridLayout>) {
  const { children, isHidden, isLazy } = model.useState();
  const styles = useStyles2(getStyles, model.state);
  const { layoutOrchestrator, isEditing } = useDashboardState(model);
  const layoutManager = sceneGraph.getAncestor(model, AutoGridLayoutManager);
  const { fillScreen } = layoutManager.useState();

  if (isHidden || !layoutOrchestrator) {
    return null;
  }

  return (
    <div
      className={cx(styles.container, fillScreen && styles.containerFillScreen, isEditing && styles.containerEditing)}
      ref={model.containerRef}
    >
      {children.map((item) =>
        isLazy ? (
          <LazyLoader key={item.state.key!} className={styles.container}>
            <item.Component key={item.state.key} model={item} />
          </LazyLoader>
        ) : (
          <item.Component key={item.state.key} model={item} />
        )
      )}
      {isEditing && (
        <div className={cx(styles.addAction, 'dashboard-canvas-add-button')}>
          <Button
            variant="primary"
            fill="text"
            icon="plus"
            onClick={() => layoutManager.addPanel(getDefaultVizPanel())}
          >
            <Trans i18nKey="dashboard.canvas-actions.add-panel">Add panel</Trans>
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  icon="list-ul"
                  label={t('dashboard.canvas-actions.group-into-row', 'Group into row')}
                  onClick={() => {
                    addNewRowTo(layoutManager);
                  }}
                ></Menu.Item>
                <Menu.Item
                  icon="layers"
                  label={t('dashboard.canvas-actions.group-into-tab', 'Group into tab')}
                  onClick={() => {
                    addNewTabTo(layoutManager);
                  }}
                ></Menu.Item>
              </Menu>
            }
          >
            <Button
              variant="primary"
              fill="text"
              icon="layers"
              onClick={() => layoutManager.addPanel(getDefaultVizPanel())}
            >
              <Trans i18nKey="dashboard.canvas-actions.group-panels">Group panels</Trans>
            </Button>
          </Dropdown>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, state: AutoGridLayoutState) => ({
  container: css({
    display: 'grid',
    position: 'relative',
    gridTemplateColumns: state.templateColumns,
    gridTemplateRows: state.templateRows || 'unset',
    gridAutoRows: state.autoRows || 'unset',
    rowGap: theme.spacing(state.rowGap ?? 1),
    columnGap: theme.spacing(state.columnGap ?? 1),
    justifyItems: state.justifyItems || 'unset',
    alignItems: state.alignItems || 'unset',
    justifyContent: state.justifyContent || 'unset',
    [theme.breakpoints.down('md')]: state.md
      ? {
          gridTemplateRows: state.md.templateRows,
          gridTemplateColumns: state.md.templateColumns,
          rowGap: state.md.rowGap ? theme.spacing(state.md.rowGap ?? 1) : undefined,
          columnGap: state.md.columnGap ? theme.spacing(state.md.rowGap ?? 1) : undefined,
          justifyItems: state.md.justifyItems,
          alignItems: state.md.alignItems,
          justifyContent: state.md.justifyContent,
        }
      : undefined,
    // Show add action when hovering over the grid
    '&:hover': {
      '.dashboard-canvas-add-button': {
        opacity: 1,
        filter: 'unset',
      },
    },
  }),
  containerFillScreen: css({
    flexGrow: 1,
  }),
  containerEditing: css({
    paddingBottom: theme.spacing(5),
    position: 'relative',
  }),
  wrapper: css({
    display: 'grid',
    position: 'relative',
    width: '100%',
    height: '100%',
  }),
  addAction: css({
    position: 'absolute',
    padding: theme.spacing(1, 0),
    height: theme.spacing(5),
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  dragging: css({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.portal + 1,
    pointerEvents: 'none',
  }),
});
