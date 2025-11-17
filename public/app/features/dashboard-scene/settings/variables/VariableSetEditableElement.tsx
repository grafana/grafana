import { css } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Box, Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import { openAddVariablePane } from './VariableAddEditableElement';

function useEditPaneOptions(this: VariableSetEditableElement, set: SceneVariableSet): OptionsPaneCategoryDescriptor[] {
  const variableListId = useId();
  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'variables' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: variableListId,
        skipField: true,
        render: () => <VariableList set={set} />,
      })
    );
  }, [set, variableListId]);

  return [options];
}

export class VariableSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private set: SceneVariableSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
      icon: 'x',
      instanceName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
    };
  }

  public getOutlineChildren() {
    return this.set.state.variables;
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.set);
}

export function VariableList({ set }: { set: SceneVariableSet }) {
  const { variables } = set.useState();
  const styles = useStyles2(getStyles);
  const canAdd = set.parent instanceof DashboardScene;

  const onEditVariable = useCallback(
    (variable: SceneVariable) => {
      const { editPane } = getDashboardSceneFor(set).state;
      editPane.selectObject(variable, variable.state.key!);
    },
    [set]
  );

  const onAddVariable = useCallback(() => {
    openAddVariablePane(getDashboardSceneFor(set));
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [set]);

  return (
    <Stack direction="column" gap={0}>
      {variables.map((variable) => (
        // TODO fix keyboard a11y here
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
        <div className={styles.variableItem} key={variable.state.name} onClick={() => onEditVariable(variable)}>
          <Text>${variable.state.name}</Text>
          <Stack direction="row" gap={1} alignItems="center">
            <Button variant="primary" size="sm" fill="outline">
              <Trans i18nKey="dashboard.edit-pane.variables.select-variable">Select</Trans>
            </Button>
          </Stack>
        </div>
      ))}
      {canAdd && (
        <Box paddingBottom={1} display={'flex'}>
          <Button
            fullWidth
            icon="plus"
            size="sm"
            variant="secondary"
            onClick={onAddVariable}
            data-testid={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variables.add-variable">Add variable</Trans>
          </Button>
        </Box>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    variableItem: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      '&:last-child': {
        marginBottom: theme.spacing(2),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
  };
}
