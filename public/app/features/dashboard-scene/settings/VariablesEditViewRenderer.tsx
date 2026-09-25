import { useMemo } from 'react';

import { type NavModel, type NavModelItem, PageLayoutType } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNewLayouts, useFlagGrafanaDashboardSettingsRedesign } from '@grafana/runtime/internal';
import { type SceneComponentProps, type SceneVariable } from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import {
  HIGHLIGHT_CATEGORY_PARAM_NAME,
  CATEGORY_PARAM_NAME,
} from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { type DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { SidebarCategoryType } from '../sidebar/types';
import { DashboardInteractions } from '../utils/interactions';
import { isPredefinedOrigin } from '../utils/predefinedVariables';
import { getDashboardSceneFor } from '../utils/utils';

import { type VariablesEditView } from './VariablesEditView';
import { useDashboardEditPageNav } from './utils';
import { ProvisionedVariablesSection } from './variables/ProvisionedVariablesSection';
import { VariableEditorForm } from './variables/VariableEditorForm';
import { VariableEditorList } from './variables/VariableEditorList';
import { VariablesUnknownTable } from './variables/VariablesUnknownTable';
import { type EditableVariableType, isVariableEditable } from './variables/utils';

export function VariablesEditViewRenderer({ model }: SceneComponentProps<VariablesEditView>) {
  const dashboard = model.getDashboard();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  // get variables from dashboard state
  const { onDelete, onDuplicated, onOrderChanged, onEdit, onTypeChange, onGoBack, onAdd } = model;
  const { variables } = model.getVariableSet().useState();
  const { editIndex } = model.useState();
  const defaultVariables = useMemo(
    () => variables.filter((v) => !isVariableEditable(v) && !isPredefinedOrigin(v.state.origin)),
    [variables]
  );
  const usagesNetwork = useMemo(() => model.getUsagesNetwork(), [model]);
  const usages = useMemo(() => model.getUsages(), [model]);
  const saveModel = model.getSaveModel();

  const isDynamicDashboardsEnabled = useFlagDashboardNewLayouts();
  const isSettingsPageRedesignEnabled = useFlagGrafanaDashboardSettingsRedesign();

  const goToSidebar = () => {
    // close settings and open dashboard sidebar
    const dashboard = getDashboardSceneFor(model);
    dashboard.state.sidebar.selectObject(dashboard);
    locationService.partial({
      editview: null,
      [HIGHLIGHT_CATEGORY_PARAM_NAME]: SidebarCategoryType.DashboardVariables,
      [CATEGORY_PARAM_NAME]: SidebarCategoryType.DashboardVariables,
    });

    DashboardInteractions.takeMeToSidebarClicked({ item: 'variables' });
  };

  if (isDynamicDashboardsEnabled && isSettingsPageRedesignEnabled) {
    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <Alert
          severity="info"
          title={t('dashboard-scene.dashboard-settings.variables.title-moved', 'Looking for variable settings?')}
        >
          <Trans i18nKey="dashboard-scene.dashboard-settings.variables.description-moved">
            Variable settings have moved to the dashboard&apos;s sidebar.
          </Trans>
          <Button onClick={goToSidebar} fill="text" variant="primary" size="md">
            <Trans i18nKey="dashboard-scene.dashboard-settings.variables.button-moved">Take me there</Trans>
          </Button>
        </Alert>
      </Page>
    );
  }

  if (editIndex !== undefined && variables[editIndex]) {
    const variable = variables[editIndex];
    if (variable) {
      return (
        <VariableEditorSettingsView
          variable={variable}
          onTypeChange={onTypeChange}
          onGoBack={onGoBack}
          pageNav={pageNav}
          navModel={navModel}
          dashboard={dashboard}
          onDelete={onDelete}
        />
      );
    }
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <VariableEditorList
        variables={variables}
        usages={usages}
        usagesNetwork={usagesNetwork}
        onDelete={onDelete}
        onDuplicate={onDuplicated}
        onChangeOrder={onOrderChanged}
        onAdd={onAdd}
        onEdit={onEdit}
      />
      {defaultVariables.length > 0 && <ProvisionedVariablesSection variables={defaultVariables} />}
      <VariablesUnknownTable variables={variables} dashboard={saveModel} />
    </Page>
  );
}

interface VariableEditorSettingsEditViewProps {
  variable: SceneVariable;
  pageNav: NavModelItem;
  navModel: NavModel;
  dashboard: DashboardScene;
  onTypeChange: (variableType: EditableVariableType) => void;
  onGoBack: () => void;
  onDelete: (variableName: string) => void;
}

function VariableEditorSettingsView({
  variable,
  pageNav,
  navModel,
  dashboard,
  onTypeChange,
  onGoBack,
  onDelete,
}: VariableEditorSettingsEditViewProps) {
  const { name } = variable.useState();

  const editVariablePageNav = {
    text: name,
    parentItem: pageNav,
  };
  return (
    <Page navModel={navModel} pageNav={editVariablePageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <VariableEditorForm
        variable={variable}
        onTypeChange={onTypeChange}
        onGoBack={onGoBack}
        onDelete={onDelete}
        // force refresh when navigating using back/forward between variables
        key={variable.state.key}
      />
    </Page>
  );
}
