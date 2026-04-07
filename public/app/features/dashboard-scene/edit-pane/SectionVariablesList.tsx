import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type SceneObject, SceneVariableSet } from '@grafana/scenes';
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
  const variableCount =
    variableSet instanceof SceneVariableSet
      ? filterSectionRepeatLocalVariables(variableSet.state.variables, variableSet).length
      : 0;
  const dashboard = getDashboardSceneFor(sectionOwner);

  return (
    <Stack direction="row" alignItems="center" gap={1} flex={1}>
      <span style={{ flexGrow: 1 }}>
        {isExpanded || variableCount === 0
          ? t('dashboard.edit-pane.section-variables.title', 'Variables')
          : `${t('dashboard.edit-pane.section-variables.title', 'Variables')} (${variableCount})`}
      </span>
      <Button
        icon="plus"
        variant="secondary"
        size="sm"
        fill="text"
        onClick={(e) => {
          e.stopPropagation();
          openAddSectionVariablePane(dashboard, sectionOwner);
        }}
        tooltip={t('dashboard.edit-pane.section-variables.add-tooltip', 'Add variable')}
      />
    </Stack>
  );
}

export interface SectionVariablesListProps {
  /** Scene object that owns section-local variables */
  sectionOwner: SceneObject;
}

export function SectionVariablesList({ sectionOwner }: SectionVariablesListProps) {
  const variableSet = sectionOwner.state.$variables;
  const variables =
    variableSet instanceof SceneVariableSet
      ? filterSectionRepeatLocalVariables(variableSet.useState().variables, variableSet)
      : [];
  const dashboard = getDashboardSceneFor(sectionOwner);

  if (variables.length === 0) {
    return (
      <Box display="flex" paddingTop={0} paddingBottom={2}>
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
    );
  }

  return (
    <Stack direction="column" gap={0}>
      {variables.map((variable) => (
        <Button
          key={variable.state.key ?? variable.state.name}
          variant="secondary"
          size="sm"
          fill="text"
          onClick={() =>
            dashboard.state.editPane.selectObject(variable, variable.state.key ?? variable.state.name, {
              force: true,
            })
          }
        >
          {variable.state.name}
        </Button>
      ))}
    </Stack>
  );
}
