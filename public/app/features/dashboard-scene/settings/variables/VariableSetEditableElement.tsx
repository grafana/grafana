import { css } from '@emotion/css';
import { useId, useMemo } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Box, Button, Card, Stack, Text, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { getDashboardSceneFor } from '../../utils/utils';

import { EditableVariableType, getNextAvailableId, getVariableScene, getVariableTypeSelectOptions } from './utils';

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

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const variableListId = useId();
    const set = this.set;

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
}

function VariableList({ set }: { set: SceneVariableSet }) {
  const { variables } = set.useState();
  const styles = useStyles2(getStyles);
  const [isAdding, setIsAdding] = useToggle(false);
  const canAdd = set.parent instanceof DashboardScene;

  const onEditVariable = (variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(set).state;
    editPane.selectObject(variable, variable.state.key!);
  };

  const onAddVariable = (type: EditableVariableType) => {
    const { variables } = set.state;
    const nextName = getNextAvailableId(type, variables);
    const newVar = getVariableScene(type, { name: nextName });

    dashboardEditActions.addVariable({
      source: set,
      addedObject: newVar,
    });

    setIsAdding(false);
  };

  if (isAdding) {
    return <VariableTypeSelection onAddVariable={onAddVariable} />;
  }

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
            onClick={setIsAdding}
            data-testid={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variables.add-variable">Add variable</Trans>
          </Button>
        </Box>
      )}
    </Stack>
  );
}

interface VariableTypeSelectionProps {
  onAddVariable: (type: EditableVariableType) => void;
}

function VariableTypeSelection({ onAddVariable }: VariableTypeSelectionProps) {
  const options = getVariableTypeSelectOptions();
  const styles = useStyles2(getStyles);

  return (
    <Stack direction={'column'} gap={0}>
      <Box paddingBottom={1} display={'flex'}>
        <Trans i18nKey="dashboard.edit-pane.variables.select-type">Choose variable type</Trans>
      </Box>
      <Stack direction="column">
        {options.map((option) => (
          <Card
            isCompact
            noMargin
            onClick={() => onAddVariable(option.value!)}
            key={option.value}
            title={t('dashboard.edit-pane.variables.select-type-card-tooltip', 'Click to select type')}
            data-testid={selectors.components.PanelEditor.ElementEditPane.variableType(option.value!)}
          >
            <Card.Heading>{option.label}</Card.Heading>
            <Card.Description className={styles.cardDescription}>{option.description}</Card.Description>
          </Card>
        ))}
      </Stack>
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
    cardDescription: css({
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(0),
    }),
  };
}
