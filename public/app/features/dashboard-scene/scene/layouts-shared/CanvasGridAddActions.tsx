import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getDefaultVizPanel } from '../../utils/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

import { addNewRowTo, addNewTabTo } from './addNew';
import { useClipboardState } from './useClipboardState';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function CanvasGridAddActions({ layoutManager }: Props) {
  const styles = useStyles2(getStyles);
  const { hasCopiedPanel } = useClipboardState();

  return (
    <div className={cx(styles.addAction, 'dashboard-canvas-add-button')}>
      <Button variant="primary" fill="text" icon="plus" onClick={() => layoutManager.addPanel(getDefaultVizPanel())}>
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
      {hasCopiedPanel && layoutManager.pastePanel && (
        <Button
          variant="primary"
          fill="text"
          icon="layers"
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
