import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type DashboardScene } from '../DashboardScene';

import { DashboardControlsMenu } from './DashboardControlsMenu';
import { useDashboardControls } from './utils';

export const DASHBOARD_CONTROLS_MENU_ARIA_LABEL = 'Dashboard controls menu';
export const DASHBOARD_CONTROLS_MENU_TITLE = 'Dashboard controls';

export function DashboardControlsButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { uid, isEditing } = dashboard.useState();
  const { variables, links, annotations } = useDashboardControls(dashboard);
  const dashboardControlsCount = variables.length + links.length + annotations.length;
  const hasDashboardControls = dashboardControlsCount > 0;
  const [key, setKey] = useState('');

  // hack to prevent the controls menu dropdown to appear above the confirmation modal (e.g. when deleting a variable)
  // we do this because Dropdown should pass zIndex.dropdown to Portal but does not
  // passing the zIndex seems to be the right thing to do but may break many things out there
  useEffect(() => {
    const handler = () => {
      setKey(String(Date.now()));
    };
    const sub = appEvents.subscribe(ShowConfirmModalEvent, handler);
    return () => {
      sub.unsubscribe();
    };
  }, []);

  if (!hasDashboardControls) {
    return null;
  }

  return (
    <Dropdown
      key={key}
      placement="bottom-start"
      overlay={
        <DashboardControlsMenu
          variables={variables}
          links={links}
          annotations={annotations}
          dashboardUID={uid}
          isEditing={isEditing}
          dashboard={dashboard}
        />
      }
    >
      <ToolbarButton
        aria-label={t('dashboard.controls.menu.aria-label', DASHBOARD_CONTROLS_MENU_ARIA_LABEL)}
        title={t('dashboard.controls.menu.title', DASHBOARD_CONTROLS_MENU_TITLE)}
        data-testid={selectors.pages.Dashboard.ControlsButton}
        icon="sliders-v-alt"
        iconSize="md"
        variant="canvas"
        className={styles.dropdownButton}
      >
        + {dashboardControlsCount}
      </ToolbarButton>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dropdownButton: css({
    display: 'inline-flex',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
