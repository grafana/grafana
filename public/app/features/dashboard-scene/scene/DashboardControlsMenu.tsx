import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneVariable } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Box, Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';

import { DashboardLinkRenderer } from './DashboardLinkRenderer';
import { DashboardScene } from './DashboardScene';
import { VariableValueSelectWrapper } from './VariableControls';

export const DASHBOARD_CONTROLS_MENU_ARIA_LABEL = 'Dashboard controls menu';
export const DASHBOARD_CONTROLS_MENU_TITLE = 'Dashboard controls';

export function DashboardControlsButton({ dashboard }: { dashboard: DashboardScene }) {
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

interface VariablesMenuProps {
  variables: SceneVariable[];
  links: DashboardLink[];
  dashboardUID: string;
}

function DashboardControlsMenu({ variables, links, dashboardUID }: VariablesMenuProps) {
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
      padding={1}
      gap={0.5}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Variables */}
      {variables.map((variable) => (
        <div className={styles.menuItem} key={variable.state.key}>
          <VariableValueSelectWrapper variable={variable} inMenu />
        </div>
      ))}

      {/* Links */}
      {links.map((link, index) => (
        <div className={styles.menuItem} key={`${link.title}-$${index}`}>
          <DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />
        </div>
      ))}
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuItem: css({
    padding: theme.spacing(0.5),
  }),
});
