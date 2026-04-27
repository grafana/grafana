import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { config } from '@grafana/runtime';
import { type SceneDataLayerProvider, type SceneVariable } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';
import { Menu, ScrollContainer } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { sortDefaultLinksFirst, sortDefaultVarsFirst } from '../../utils/dashboardControls';
import { DataLayerControlEditWrapper } from '../DashboardDataLayerControls';
import { DashboardLinkRenderer } from '../DashboardLinkRenderer';
import { type DashboardScene } from '../DashboardScene';
import { VariableValueSelectWrapper } from '../VariableControls';

interface DashboardControlsMenuProps {
  variables: SceneVariable[];
  links: DashboardLink[];
  annotations: SceneDataLayerProvider[];
  dashboardUID?: string;
  isEditing?: boolean;
  dashboard: DashboardScene;
}

export function DashboardControlsMenu({
  variables,
  links,
  annotations,
  dashboardUID,
  isEditing,
  dashboard,
}: DashboardControlsMenuProps) {
  const isEditingNewLayouts = isEditing && config.featureToggles.dashboardNewLayouts;
  const fullLinks = dashboard.state.links ?? [];
  const styles = useStyles2(getStyles);

  return (
    <ScrollContainer
      minWidth={32}
      borderColor={'weak'}
      borderStyle={'solid'}
      boxShadow={'z3'}
      borderRadius={'default'}
      backgroundColor={'primary'}
      maxHeight={'calc(100vh - 80px)'}
      overflowX={'hidden'}
      onClick={(e) => {
        // Normally, clicking the overlay closes the dropdown.
        // We stop event propagation here to keep it open while users interact with variable controls.
        e.stopPropagation();
      }}
    >
      <div className={styles.items}>
        {/* Variables */}
        {sortDefaultVarsFirst(variables).map((variable) => (
          <div key={variable.state.key}>
            <VariableValueSelectWrapper variable={variable} inMenu isEditingNewLayouts={isEditingNewLayouts} />
          </div>
        ))}

        {/* Annotation layers */}
        {annotations.length > 0 &&
          annotations.map((layer) => (
            <div key={layer.state.key}>
              <DataLayerControlEditWrapper layer={layer} inMenu />
            </div>
          ))}

        {/* Links */}
        {links.length > 0 && (
          <>
            {(variables.length > 0 || annotations.length > 0) && <MenuDivider />}
            {sortDefaultLinksFirst(links).map((link, index) => (
              <div key={`${link.title}-${index}`}>
                <DashboardLinkRenderer
                  link={link}
                  dashboardUID={dashboardUID}
                  inMenu
                  linkIndex={fullLinks.indexOf(link)}
                  dashboard={dashboard}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </ScrollContainer>
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
  items: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
  }),
  divider: css({
    marginTop: theme.spacing(1),
    padding: theme.spacing(0, 0.5),
  }),
});
