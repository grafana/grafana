import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDefaultVizPanel } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

import { addNewRowTo, addNewTabTo } from './addNew';
import { useClipboardState } from './useClipboardState';
import { ungroupLayout } from './utils';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function CanvasGridAddActions({ layoutManager }: Props) {
  const styles = useStyles2(getStyles);
  const { hasCopiedPanel } = useClipboardState();

  return (
    <div className={cx(styles.addAction, 'dashboard-canvas-add-button')}>
      <Button
        variant="primary"
        fill="text"
        icon="plus"
        data-testid={selectors.components.CanvasGridAddActions.addPanel}
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
      {renderUngroupAction(layoutManager)}
      {hasCopiedPanel && layoutManager.pastePanel && (
        <Button
          variant="primary"
          fill="text"
          icon="clipboard-alt"
          onClick={() => {
            layoutManager.pastePanel?.();
          }}
        >
          <Trans i18nKey="dashboard.canvas-actions.paste-panel">Paste panel</Trans>
        </Button>
      )}
    </div>
  );
}

function renderUngroupAction(layoutManager: DashboardLayoutManager) {
  const parent = layoutManager.parent;

  if (parent instanceof DashboardScene) {
    return null;
  }

  const parentLayout = dashboardSceneGraph.getLayoutManagerFor(layoutManager.parent!);

  const onUngroup = () => {
    ungroupLayout(parentLayout, layoutManager);
  };

  if (parentLayout instanceof TabsLayoutManager) {
    return <UngroupButtonTabs parentLayout={parentLayout} onClick={onUngroup} />;
  }

  if (parentLayout instanceof RowsLayoutManager) {
    return <UngroupButtonRows parentLayout={parentLayout} onClick={onUngroup} />;
  }

  return null;
}

interface UngroupButtonProps<T> {
  parentLayout: T;
  onClick: () => void;
}

function UngroupButtonTabs({ parentLayout, onClick }: UngroupButtonProps<TabsLayoutManager>) {
  const { tabs } = parentLayout.useState();

  if (tabs.length > 1) {
    return null;
  }

  return (
    <Button variant="primary" fill="text" icon="layers-slash" onClick={onClick}>
      <Trans i18nKey="dashboard.canvas-actions.un-group-panels">Ungroup</Trans>
    </Button>
  );
}

function UngroupButtonRows({ parentLayout, onClick }: UngroupButtonProps<RowsLayoutManager>) {
  const { rows } = parentLayout.useState();

  if (rows.length > 1) {
    return null;
  }

  return (
    <Button variant="primary" fill="text" icon="layers-slash" onClick={onClick}>
      <Trans i18nKey="dashboard.canvas-actions.un-group-panels">Ungroup</Trans>
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
});
