import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneObject, SceneVariableSet, sceneUtils } from '@grafana/scenes';
import { Box, Button, Stack } from '@grafana/ui';

import { openAddSectionVariablePane } from '../settings/variables/VariableTypeSelectionPane';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';
import { filterSectionRepeatLocalVariables } from '../variables/utils';

export interface SectionVariablesCategoryTitleProps {
  /** Scene object that owns section-local variables */
  sectionOwner: SceneObject;
  isExpanded: boolean;
}

export function SectionVariablesCategoryTitle({ sectionOwner, isExpanded }: SectionVariablesCategoryTitleProps) {
  const variableSet = sectionOwner.state.$variables;
  const allVariables =
    variableSet instanceof SceneVariableSet
      ? filterSectionRepeatLocalVariables(variableSet.state.variables, variableSet)
      : [];
  const variableCount = config.featureToggles.dashboardUnifiedDrilldownControls
    ? allVariables.filter((v) => !sceneUtils.isAdHocVariable(v)).length
    : allVariables.length;

  return (
    <Stack direction="row" alignItems="center" gap={1} flex={1}>
      <span style={{ flexGrow: 1 }}>
        {isExpanded || variableCount === 0
          ? t('dashboard.edit-pane.section-variables.title', 'Variables')
          : `${t('dashboard.edit-pane.section-variables.title', 'Variables')} (${variableCount})`}
      </span>
    </Stack>
  );
}

export interface SectionVariablesListProps {
  /** Scene object that owns section-local variables */
  sectionOwner: SceneObject;
}

export function SectionVariablesList({ sectionOwner }: SectionVariablesListProps) {
  const variableSet = sectionOwner.state.$variables;
  const allVariables =
    variableSet instanceof SceneVariableSet
      ? filterSectionRepeatLocalVariables(variableSet.useState().variables, variableSet)
      : [];
  const variables = config.featureToggles.dashboardUnifiedDrilldownControls
    ? allVariables.filter((v) => !sceneUtils.isAdHocVariable(v))
    : allVariables;
  const dashboard = getDashboardSceneFor(sectionOwner);

  return (
    <Stack direction="column" gap={0}>
      {variables.map((variable) => (
        <Button
          key={variable.state.key!}
          variant="secondary"
          size="sm"
          fill="text"
          onClick={() => dashboard.state.editPane.selectObject(variable, { force: true })}
        >
          {variable.state.name}
        </Button>
      ))}

      <Box display="flex" paddingTop={variables.length > 0 ? 1 : 0} paddingBottom={2}>
        <Button
          fullWidth
          icon="plus"
          size="sm"
          variant="secondary"
          onClick={() => {
            openAddSectionVariablePane(dashboard, sectionOwner);
            DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
          }}
          data-testid={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
        >
          <Trans i18nKey="dashboard-scene.variables-list.add-variable">Add variable</Trans>
        </Button>
      </Box>
    </Stack>
  );
}
