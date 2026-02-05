import { useMemo, useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneVariable, SceneVariableSet, sceneUtils } from '@grafana/scenes';
import { Alert, Button, Field, Input, Stack, Text, TextLink } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { useConditionalRenderingEditor } from '../../conditional-rendering/hooks/useConditionalRenderingEditor';
import { dashboardEditActions } from '../../edit-pane/shared';
import { getNextAvailableId, getVariableScene } from '../../settings/variables/utils';
import { getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';
import { generateUniqueTitle, useEditPaneInputAutoFocus } from '../layouts-shared/utils';

import { TabItem } from './TabItem';

export function useEditOptions(this: TabItem, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const model = this;
  const { layout } = model.useState();

  const tabCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({ title: '', id: 'tab-item-options' }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.tabs-layout.tab-options.title-option', 'Title'),
          id: 'tab-options-title',
          render: (descriptor) => <TabTitleInput id={descriptor.props.id} tab={model} isNewElement={isNewElement} />,
        })
      ),
    [isNewElement, model]
  );

  const repeatCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.tabs-layout.tab-options.repeat.title', 'Repeat options'),
        id: 'repeat-options',
        isOpenDefault: false,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.tabs-layout.tab-options.repeat.variable.title', 'Repeat by variable'),
          id: 'tab-options-repeat-variable',
          description: t(
            'dashboard.tabs-layout.tab-options.repeat.variable.description',
            'Repeat this tab for each value in the selected variable.'
          ),
          render: (descriptor) => <TabRepeatSelect id={descriptor.props.id} tab={model} />,
        })
      ),
    [model]
  );

  const layoutCategory = useLayoutCategory(layout);
  const sectionVariablesCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.tabs-layout.tab-options.section-variables.title', 'Tab variables'),
        id: 'dash-tab-section-variables',
        isOpenDefault: false,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: 'dash-tab-section-variables-list',
          skipField: true,
          render: () => <TabSectionVariables tab={model} />,
        })
      ),
    [model]
  );

  const editOptions = [tabCategory, sectionVariablesCategory, ...layoutCategory, repeatCategory];

  const conditionalRenderingCategory = useMemo(
    () => useConditionalRenderingEditor(model.state.conditionalRendering),
    [model]
  );

  if (conditionalRenderingCategory) {
    editOptions.push(conditionalRenderingCategory);
  }

  return editOptions;
}

function TabTitleInput({ tab, isNewElement, id }: { tab: TabItem; isNewElement: boolean; id?: string }) {
  const { title } = tab.useState();
  const prevTitle = useRef('');

  const ref = useEditPaneInputAutoFocus({ autoFocus: isNewElement });
  const hasUniqueTitle = tab.hasUniqueTitle();

  return (
    <Field
      invalid={!hasUniqueTitle}
      error={
        !hasUniqueTitle ? t('dashboard.tabs-layout.tab-options.title-not-unique', 'Title should be unique') : undefined
      }
    >
      <Input
        id={id}
        ref={ref}
        title={t('dashboard.tabs-layout.tab-options.title-option', 'Title')}
        value={title}
        onFocus={() => (prevTitle.current = title || '')}
        onBlur={() => editTabTitleAction(tab, title || '', prevTitle.current || '')}
        onChange={(e) => tab.onChangeTitle(e.currentTarget.value)}
        data-testid={selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput}
      />
    </Field>
  );
}

function TabRepeatSelect({ tab, id }: { tab: TabItem; id?: string }) {
  const { layout } = tab.useState();

  const isAnyPanelUsingDashboardDS = layout.getVizPanels().some((vizPanel) => {
    const runner = getQueryRunnerFor(vizPanel);
    return (
      runner?.state.datasource?.uid === SHARED_DASHBOARD_QUERY ||
      (runner?.state.datasource?.uid === MIXED_DATASOURCE_NAME &&
        runner?.state.queries.some((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY))
    );
  });

  return (
    <>
      <RepeatRowSelect2
        id={id}
        sceneContext={tab}
        repeat={tab.state.repeatByVariable}
        onChange={(repeat) => tab.onChangeRepeat(repeat)}
      />
      {isAnyPanelUsingDashboardDS ? (
        <Alert
          data-testid={selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage}
          severity="warning"
          title=""
          topSpacing={3}
          bottomSpacing={0}
        >
          <p>
            <Trans i18nKey="dashboard.tabs-layout.tab.repeat.warning">
              Panels in this tab use the {{ SHARED_DASHBOARD_QUERY }} data source. These panels will reference the panel
              in the original tab, not the ones in the repeated tabs.
            </Trans>
          </p>
          <TextLink
            external
            href={
              'https://grafana.com/docs/grafana/next/visualizations/dashboards/build-dashboards/create-dashboard/#repeating-rows-and-tabs-and-the-dashboard-special-data-source'
            }
          >
            <Trans i18nKey="dashboard.tabs-layout.tab.repeat.learn-more">Learn more</Trans>
          </TextLink>
        </Alert>
      ) : undefined}
    </>
  );
}

function editTabTitleAction(tab: TabItem, title: string, prevTitle: string) {
  if (title !== '' && title === prevTitle) {
    return;
  }

  if (title === '') {
    const tabs = tab.getParentLayout().getTabsIncludingRepeats();
    const existingNames = new Set(tabs.map((tab) => tab.state.title).filter((title) => title !== undefined));
    title = generateUniqueTitle('New tab', existingNames);
  }

  dashboardEditActions.edit({
    description: t('dashboard.edit-actions.tab-title', 'Change tab title'),
    source: tab,
    perform: () => tab.onChangeTitle(title),
    undo: () => tab.onChangeTitle(prevTitle),
  });
}

function TabSectionVariables({ tab }: { tab: TabItem }) {
  const variableSet = tab.state.$variables;
  const variables = variableSet?.useState().variables ?? [];
  const editableVariables = variables.filter(
    (variable) => sceneUtils.isAdHocVariable(variable) || sceneUtils.isGroupByVariable(variable)
  );
  const dashboard = getDashboardSceneFor(tab);
  const canAddGroupBy = config.featureToggles.groupByVariable;

  const onAddVariable = (type: 'adhoc' | 'groupby') => {
    const set = ensureTabVariableSet(tab, variableSet);
    if (!set) {
      return;
    }

    const newVar = getVariableScene(type, {
      name: getNextAvailableId(type, set.state.variables ?? []),
    });
    dashboardEditActions.addVariable({ source: set, addedObject: newVar });
    const variableKey = newVar.state.key ?? newVar.state.name;
    dashboard.state.editPane.selectObject(newVar, variableKey, { force: true, multi: false });
  };

  return (
    <Stack direction="column" gap={1}>
      <Text>
        <Trans i18nKey="dashboard.tabs-layout.tab-options.section-variables.description">
          Add ad hoc filters and group by variables that only apply to this tab.
        </Trans>
      </Text>
      <Stack direction="row" gap={1}>
        <Button variant="secondary" size="sm" onClick={() => onAddVariable('adhoc')}>
          <Trans i18nKey="dashboard.tabs-layout.tab-options.section-variables.add-adhoc">Add ad hoc filters</Trans>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onAddVariable('groupby')} disabled={!canAddGroupBy}>
          <Trans i18nKey="dashboard.tabs-layout.tab-options.section-variables.add-groupby">Add group by</Trans>
        </Button>
      </Stack>
      {editableVariables.length === 0 ? (
        <Text color="secondary">
          <Trans i18nKey="dashboard.tabs-layout.tab-options.section-variables.empty">No tab variables yet.</Trans>
        </Text>
      ) : (
        <Stack direction="column" gap={0}>
          {editableVariables.map((variable) => (
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
              {getVariableLabel(variable)}
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ensureTabVariableSet(tab: TabItem, currentSet?: SceneVariableSet): SceneVariableSet | undefined {
  if (currentSet) {
    return currentSet;
  }

  const newSet = new SceneVariableSet({ variables: [] });
  const currentState = tab.state.$variables;
  dashboardEditActions.edit({
    description: t('dashboard.tabs-layout.tab-options.section-variables.create', 'Create tab variables'),
    source: tab,
    perform: () => tab.setState({ $variables: newSet }),
    undo: () => tab.setState({ $variables: currentState }),
  });
  return newSet;
}

function getVariableLabel(variable: SceneVariable) {
  const name = variable.state.label || variable.state.name;
  if (sceneUtils.isAdHocVariable(variable)) {
    return t('dashboard.tabs-layout.tab-options.section-variables.label-adhoc', 'Ad hoc: {{name}}', { name });
  }
  if (sceneUtils.isGroupByVariable(variable)) {
    return t('dashboard.tabs-layout.tab-options.section-variables.label-groupby', 'Group by: {{name}}', { name });
  }
  return name;
}
