import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Box, Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';
import { VariableValueSelectWrapper } from './VariableControls';

export const DROPDOWN_CONTROLS_ARIA_LABEL = 'Dashboard controls menu';
export const DROPDOWN_CONTROLS_TITLE = 'Dashboard controls';

export function DropdownVariableControls({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const variables = sceneGraph
    .getVariables(dashboard)!
    .useState()
    .variables.filter((v) => v.state.showInControlsMenu === true);

  if (variables.length === 0) {
    return null;
  }

  return (
    <Dropdown
      placement="bottom-end"
      overlay={
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
          {variables.map((variable) => (
            <div className={styles.menuItem} key={variable.state.key}>
              <VariableValueSelectWrapper variable={variable} inMenu />
            </div>
          ))}
        </Box>
      }
    >
      <ToolbarButton
        aria-label={t('dashboard.controls.menu.aria-label', DROPDOWN_CONTROLS_ARIA_LABEL)}
        title={t('dashboard.controls.menu.title', DROPDOWN_CONTROLS_TITLE)}
        icon="ellipsis-v"
        iconSize="md"
        narrow
        variant="canvas"
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuItem: css({
    padding: theme.spacing(0.5),
  }),
});
