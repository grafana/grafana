import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../DashboardScene';

import { DashboardControlsMenu } from './DashboardControlsMenu';
import { useDashboardControls } from './utils';

export const DASHBOARD_CONTROLS_MENU_ARIA_LABEL = 'Dashboard controls menu';
export const DASHBOARD_CONTROLS_MENU_TITLE = 'Dashboard controls';

export function DashboardControlsButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { uid } = dashboard.useState();
  const { variables, links, annotations } = useDashboardControls(dashboard);
  const dashboardControlsCount = variables.length + links.length + annotations.length;
  const hasDashboardControls = dashboardControlsCount > 0;

  if (!uid || !hasDashboardControls) {
    return null;
  }

  return (
    <Dropdown
      placement="bottom-end"
      overlay={
        <DashboardControlsMenu variables={variables} links={links} annotations={annotations} dashboardUID={uid} />
      }
    >
      <ToolbarButton
        aria-label={t('dashboard.controls.menu.aria-label', DASHBOARD_CONTROLS_MENU_ARIA_LABEL)}
        title={t('dashboard.controls.menu.title', DASHBOARD_CONTROLS_MENU_TITLE)}
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
  }),
});
