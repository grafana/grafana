import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneVariable } from '@grafana/scenes';
import { Button, Input, Stack, TextArea, Text, Box, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../scene/DashboardScene';
import { useLayoutCategory } from '../scene/layouts-shared/DashboardLayoutSelector';
import { EditableDashboardElement } from '../scene/types';

import { VariableEditDrawer } from './VariableEditDrawer';

export class DashboardEditableElement implements EditableDashboardElement {
  public isEditableDashboardElement: true = true;

  public constructor(private dashboard: DashboardScene) {}

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const dashboard = this.dashboard;

    // When layout changes we need to update options list
    const { body } = dashboard.useState();

    const categories = useMemo(() => {
      const topLevelOptions = new OptionsPaneCategoryDescriptor({
        title: 'Dashboard options',
        id: 'dashboard-options',
        isOpenDefault: true,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Title',
            render: function renderTitle() {
              return <DashboardTitleInput dashboard={dashboard} />;
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Description',
            render: function renderTitle() {
              return <DashboardDescriptionInput dashboard={dashboard} />;
            },
          })
        );

      const variablesCategory = new OptionsPaneCategoryDescriptor({
        title: 'Variables',
        id: 'variables',
        isOpenDefault: false,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          skipField: true,
          render: function variablesList() {
            return <VariablesList dashboard={dashboard} />;
          },
        })
      );

      return [topLevelOptions, variablesCategory];
    }, [dashboard]);

    const layoutCategory = useLayoutCategory(body);

    return [...categories, layoutCategory];
  }

  public getTypeName(): string {
    return 'Dashboard';
  }
}

export function DashboardTitleInput({ dashboard }: { dashboard: DashboardScene }) {
  const { title } = dashboard.useState();

  return <Input value={title} onChange={(e) => dashboard.setState({ title: e.currentTarget.value })} />;
}

export function DashboardDescriptionInput({ dashboard }: { dashboard: DashboardScene }) {
  const { description } = dashboard.useState();

  return <TextArea value={description} onChange={(e) => dashboard.setState({ title: e.currentTarget.value })} />;
}

interface VariablesListProps {
  dashboard: DashboardScene;
}

function VariablesList({ dashboard }: VariablesListProps) {
  const varSet = sceneGraph.getVariables(dashboard);
  const { variables } = varSet.useState();
  const styles = useStyles2(getStyles);

  const onEditVariable = (variable: SceneVariable) => {
    dashboard.showModal(new VariableEditDrawer({ variableRef: variable.getRef() }));
  };

  return (
    <Stack direction="column" gap={0}>
      {variables.map((variable) => (
        <div className={styles.variableItem} key={variable.state.name} onClick={() => onEditVariable(variable)}>
          <Text>${variable.state.name}</Text>
          <Button variant="secondary" size="sm" onClick={() => onEditVariable(variable)}>
            Edit
          </Button>
        </div>
      ))}
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
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
  };
}
