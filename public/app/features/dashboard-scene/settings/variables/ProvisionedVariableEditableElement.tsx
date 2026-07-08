import { css } from '@emotion/css';
import { useId, useMemo } from 'react';

import { type GrafanaTheme2, VariableHide } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';
import { Alert, Stack, Text, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { getPredefinedOrigin } from '../../utils/predefinedVariables';
import { SourceIcon } from '../ProvisionedControlsSection';

import { getDefinition, getEditableVariableDefinition } from './utils';

function useEditPaneOptions(this: ProvisionedVariableEditableElement): OptionsPaneCategoryDescriptor[] {
  const variable = this.variable;
  const categoryId = useId();
  const detailsId = useId();

  return useMemo(() => {
    const category = new OptionsPaneCategoryDescriptor({ title: '', id: categoryId });

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: detailsId,
        skipField: true,
        render: () => <ProvisionedVariableDetails variable={variable} />,
      })
    );

    return [category];
  }, [categoryId, detailsId, variable]);
}

export class ProvisionedVariableEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(public variable: SceneVariable) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const variableEditorDef = getEditableVariableDefinition(this.variable.state.type);
    const { label, name } = this.variable.state;
    const hasLabel = !!label && label.trim() !== '';
    const instanceName = hasLabel ? label! : name;
    const tooltip = hasLabel ? `$${name}` : undefined;

    return {
      typeName: t('dashboard.edit-pane.elements.variable', '{{type}} variable', { type: variableEditorDef.name }),
      icon: 'dollar-alt',
      instanceName,
      tooltip,
      isHidden: this.variable.state.hide === VariableHide.hideVariable,
    };
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this);
}

function ProvisionedVariableDetails({ variable }: { variable: SceneVariable }) {
  const styles = useStyles2(getStyles);
  const predefinedOrigin = getPredefinedOrigin(variable.state.origin);
  const message = predefinedOrigin
    ? predefinedOrigin.type === 'global'
      ? t(
          'dashboard.edit-pane.variable.readonly-global',
          'This global variable is managed centrally under Dashboards > Variables.'
        )
      : t(
          'dashboard.edit-pane.variable.readonly-folder',
          "This folder variable is inherited from this dashboard's folder and cannot be edited here."
        )
    : t(
        'dashboard.edit-pane.variable.readonly-provisioned',
        'This variable is provisioned by a data source plugin and cannot be edited here.'
      );

  return (
    <Stack direction="column" gap={2}>
      <Alert severity="info" title="" topSpacing={0}>
        {message}
      </Alert>
      <Stack direction="row" gap={1} alignItems="center">
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="dashboard.edit-pane.variable.readonly-name">Name</Trans>
        </Text>
        <Text>${variable.state.name}</Text>
        <SourceIcon origin={variable.state.origin} />
      </Stack>
      <div className={styles.definitionRow}>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="dashboard.edit-pane.variable.readonly-definition">Definition</Trans>
        </Text>
        <Text truncate>{getDefinition(variable)}</Text>
      </div>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    definitionRow: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
  };
}
