import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneDataLayerProvider, sceneGraph, SceneVariable } from '@grafana/scenes';
import { DashboardLink, VariableHide } from '@grafana/schema';
import { Box, Dropdown, Menu, ToolbarButton, useStyles2 } from '@grafana/ui';

import { isDashboardDataLayerSetState } from './DashboardDataLayerSet';
import { DashboardLinkRenderer } from './DashboardLinkRenderer';
import { DashboardScene } from './DashboardScene';
import { DataLayerControl } from './DataLayerControl';
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
    .variables.filter((v) => v.state.hide === VariableHide.inControlsMenu);
  const dataState = sceneGraph.getData(dashboard).useState();
  const annotationLayers = isDashboardDataLayerSetState(dataState) ? dataState.annotationLayers : [];
  const filteredAnnotationLayers = annotationLayers.filter((layer) => layer.state.placement === 'inControlsMenu');

  if ((variables.length === 0 && filteredLinks.length === 0 && filteredAnnotationLayers.length === 0) || !uid) {
    return null;
  }

  return (
    <Dropdown
      placement="bottom-end"
      overlay={
        <DashboardControlsMenu
          variables={variables}
          links={filteredLinks}
          annotationLayers={filteredAnnotationLayers}
          dashboardUID={uid}
        />
      }
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
  annotationLayers: SceneDataLayerProvider[];
  dashboardUID: string;
}

function DashboardControlsMenu({ variables, links, annotationLayers, dashboardUID }: DashboardControlsMenuProps) {
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
        <div className={cx({ [styles.menuItem]: index > 0 })} key={variable.state.key}>
          <VariableValueSelectWrapper variable={variable} inMenu />
        </div>
      ))}

      {/* Annotation layers */}
      {annotationLayers.length > 0 &&
        annotationLayers.map((layer, index) => (
          <div className={cx({ [styles.menuItem]: variables.length > 0 || index > 0 })} key={layer.state.key}>
            <DataLayerControl layer={layer} inMenu />
          </div>
        ))}

      {/* Links */}
      {links.length > 0 && (
        <>
          {(variables.length > 0 || annotationLayers.length > 0) && <MenuDivider />}
          {links.map((link, index) => (
            <div key={`${link.title}-${index}`}>
              <DashboardLinkRenderer link={link} dashboardUID={dashboardUID} inMenu />
            </div>
          ))}
        </>
      )}
    </Box>
  );
}

function MenuDivider() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.divider}>
      <Menu.Divider />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    marginTop: theme.spacing(2),
    padding: theme.spacing(0, 0.5),
  }),
  menuItem: css({
    marginTop: theme.spacing(2),
  }),
});
