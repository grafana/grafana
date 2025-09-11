import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Dropdown, Menu, ToolbarButton, useStyles2 } from '@grafana/ui';

import { DashboardLinkRenderer } from './DashboardLinkRenderer';
import { DashboardScene } from './DashboardScene';
import { VariableValueSelectWrapper } from './VariableControls';

export const DASHBOARD_CONTROLS_MENU_ARIA_LABEL = 'Dashboard controls menu';
export const DASHBOARD_CONTROLS_MENU_TITLE = 'Dashboard controls';

export function DashboardControlsMenu({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { links, uid } = dashboard.useState();
  const filteredLinks = links.filter((link) => link.placement === 'inControlsMenu');
  const variables = sceneGraph
    .getVariables(dashboard)!
    .useState()
    .variables.filter((v) => v.state.showInControlsMenu === true);

  if ((variables.length === 0 && filteredLinks.length === 0) || !uid) {
    return null;
  }

  return (
    <Dropdown
      overlay={
        <Menu
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Variables */}
          {variables.map((variable) => (
            <div className={styles.menuItem} key={variable.state.key}>
              <VariableValueSelectWrapper variable={variable} />
            </div>
          ))}

          {variables.length > 0 && filteredLinks.length > 0 && <Menu.Divider />}

          {/* Links */}
          {filteredLinks.map((link, index) => (
            <div className={styles.menuItem} key={`${link.title}-$${index}`}>
              <DashboardLinkRenderer link={link} dashboardUID={uid} />
            </div>
          ))}
        </Menu>
      }
    >
      <ToolbarButton
        aria-label={t('dashboard.controls.menu.aria-label', DASHBOARD_CONTROLS_MENU_ARIA_LABEL)}
        title={t('dashboard.controls.menu.title', DASHBOARD_CONTROLS_MENU_TITLE)}
        icon="ellipsis-v"
        iconSize="md"
        narrow
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuItem: css({
    padding: theme.spacing(0.5),
  }),
});
