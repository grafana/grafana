import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Stack, Button, useStyles2, Text, Box } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { NewObjectAddedToCanvasEvent } from '../../edit-pane/shared';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { getDashboardSceneFor } from '../../utils/utils';

import { getVariableDefault } from './utils';

export class VariableSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private set: SceneVariableSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
      icon: 'x',
      instanceName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
      isContainer: true,
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const set = this.set;

    const options = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({ title: '', id: 'variables' }).addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          skipField: true,
          render: () => <VariableList set={set} />,
        })
      );
    }, [set]);

    return [options];
  }
}

function VariableList({ set }: { set: SceneVariableSet }) {
  const { variables } = set.useState();
  const styles = useStyles2(getStyles);

  const onEditVariable = (variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(set).state;
    editPane.selectObject(variable, variable.state.key!);
  };

  const onAddVariable = () => {
    //add the new variable to the end of the array
    const newVariable = getVariableDefault(variables);
    set.setState({ variables: [...variables, newVariable] });
    set.publishEvent(new NewObjectAddedToCanvasEvent(newVariable), true);
  };

  return (
    <Stack direction="column" gap={0}>
      {variables.map((variable) => (
        <div className={styles.variableItem} key={variable.state.name} onClick={() => onEditVariable(variable)}>
          {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
          <Text>${variable.state.name}</Text>
          <Stack direction="row" gap={1} alignItems="center">
            <Button variant="primary" size="sm" fill="outline">
              <Trans i18nKey="dashboard.edit-pane.variables.select-variable">Select</Trans>
            </Button>
          </Stack>
        </div>
      ))}
      <Box paddingBottom={1} display={'flex'}>
        <Button fullWidth icon="plus" size="sm" variant="secondary" onClick={onAddVariable}>
          <Trans i18nKey="dashboard.edit-pane.variables.add-variable">Add variable</Trans>
        </Button>
      </Box>
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
