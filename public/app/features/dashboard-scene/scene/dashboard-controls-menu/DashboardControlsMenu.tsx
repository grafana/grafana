import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneDataLayerProvider, SceneVariable } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Box, Menu, useStyles2 } from '@grafana/ui';

import { DashboardLinkRenderer } from '../DashboardLinkRenderer';
import { DataLayerControl } from '../DataLayerControl';
import { VariableValueSelectWrapper } from '../VariableControls';

interface DashboardControlsMenuProps {
  variables: SceneVariable[];
  links: DashboardLink[];
  annotations: SceneDataLayerProvider[];
  dashboardUID?: string;
}

export function DashboardControlsMenu({ variables, links, annotations, dashboardUID }: DashboardControlsMenuProps) {
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
      {annotations.length > 0 &&
        annotations.map((layer, index) => (
          <div className={cx({ [styles.menuItem]: variables.length > 0 || index > 0 })} key={layer.state.key}>
            <DataLayerControl layer={layer} inMenu />
          </div>
        ))}

      {/* Links */}
      {links.length > 0 && dashboardUID && (
        <>
          {(variables.length > 0 || annotations.length > 0) && <MenuDivider />}
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
