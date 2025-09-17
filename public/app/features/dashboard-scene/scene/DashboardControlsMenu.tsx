import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneVariable } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Box, Dropdown, Menu, ToolbarButton, useStyles2 } from '@grafana/ui';

import { DashboardLinkRenderer } from './DashboardLinkRenderer';
import { DashboardScene } from './DashboardScene';
import { VariableValueSelectWrapper } from './VariableControls';

export const DASHBOARD_CONTROLS_MENU_ARIA_LABEL = 'Dashboard controls menu';
export const DASHBOARD_CONTROLS_MENU_TITLE = 'Dashboard controls';

export function DashboardControlsButton({ dashboard }: { dashboard: DashboardScene }) {
  const { links, uid } = dashboard.useState();
  // Dashboard links are not supported at the moment.
  // Reason: nesting <Dropdown> components causes issues since the inner dropdown is rendered in a portal,
  // so clicking it closes the parent dropdown (the parent sees it as an overlay click, and the event cannot easily be intercepted,
  // as it is in different HTML subtree).
  const filteredLinks = links.filter((link) => link.placement === 'inControlsMenu' && link.type !== 'dashboards');
  const variables = sceneGraph
    .getVariables(dashboard)!
    .useState()
    .variables.filter((v) => v.state.showInControlsMenu === true);

  if ((variables.length === 0 && filteredLinks.length === 0) || !uid) {
    return null;
  }

  return (
    <Dropdown
      placement="bottom-end"
      overlay={<DashboardControlsMenu variables={variables} links={filteredLinks} dashboardUID={uid} />}
    >
      <ToolbarButton
        aria-label={t('dashboard.controls.menu.aria-label', DASHBOARD_CONTROLS_MENU_ARIA_LABEL)}
        title={t('dashboard.controls.menu.title', DASHBOARD_CONTROLS_MENU_TITLE)}
        icon="ellipsis-v"
        iconSize="md"
        narrow
        variant="canvas"
      />
    </Dropdown>
  );
}

interface DashboardControlsMenuProps {
  variables: SceneVariable[];
  links: DashboardLink[];
  dashboardUID: string;
}

function DashboardControlsMenu({ variables, links, dashboardUID }: DashboardControlsMenuProps) {
  const styles = useStyles2(getStyles);

  return (
    <Box
      minWidth={32}
      borderColor={'weak'}
      borderStyle={'solid'}
      boxShadow={'z3'}
      display={'flex'}
      direction={'column'}
      borderRadius={'default'}
      backgroundColor={'primary'}
      padding={1.5}
      gap={0.5}
      onClick={(e) => {
        // Normally, clicking the overlay closes the dropdown.
        // We stop event propagation here to keep it open while users interact with variable controls.
        e.stopPropagation();
      }}
    >
      {/* Variables */}
      {variables.map((variable, index) => (
        <div className={cx(index > 0 && styles.menuItem)} key={variable.state.key}>
          <VariableValueSelectWrapper variable={variable} inMenu />
        </div>
      ))}

      {variables.length > 0 && links.length > 0 && (
        <div className={styles.divider}>
          <Menu.Divider />
        </div>
      )}

      {/* Links */}
      {links.map((link, index) => (
        <div key={`${link.title}-${index}`}>
          <DashboardLinkRenderer link={link} dashboardUID={dashboardUID} inMenu />
        </div>
      ))}
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    marginTop: theme.spacing(1),
    padding: theme.spacing(0, 0.5),
  }),
  menuItem: css({
    marginTop: theme.spacing(2),
  }),
});
