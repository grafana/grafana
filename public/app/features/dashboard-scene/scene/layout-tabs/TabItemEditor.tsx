import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Alert, Input, Field, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { useConditionalRenderingEditor } from '../../conditional-rendering/ConditionalRenderingEditor';
import { getQueryRunnerFor, useDashboard } from '../../utils/utils';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';
import { useEditPaneInputAutoFocus } from '../layouts-shared/utils';

import { TabItem } from './TabItem';

export function useEditOptions(model: TabItem, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const { layout } = model.useState();

  const tabCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({ title: '', id: 'tab-item-options' }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.tabs-layout.tab-options.title-option', 'Title'),
          render: () => <TabTitleInput tab={model} isNewElement={isNewElement} />,
        })
      ),
    [model, isNewElement]
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
          description: t(
            'dashboard.tabs-layout.tab-options.repeat.variable.description',
            'Repeat this tab for each value in the selected variable.'
          ),
          render: () => <TabRepeatSelect tab={model} />,
        })
      ),
    [model]
  );

  const layoutCategory = useLayoutCategory(layout);

  const editOptions = [tabCategory, ...layoutCategory, repeatCategory];

  const conditionalRenderingCategory = useMemo(
    () => useConditionalRenderingEditor(model.state.conditionalRendering),
    [model]
  );

  if (conditionalRenderingCategory) {
    editOptions.push(conditionalRenderingCategory);
  }

  return editOptions;
}

function TabTitleInput({ tab, isNewElement }: { tab: TabItem; isNewElement: boolean }) {
  const { title } = tab.useState();
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
        ref={ref}
        title={t('dashboard.tabs-layout.tab-options.title-option', 'Title')}
        value={title}
        onChange={(e) => tab.onChangeTitle(e.currentTarget.value)}
      />
    </Field>
  );
}

function TabRepeatSelect({ tab }: { tab: TabItem }) {
  const { layout } = tab.useState();
  const dashboard = useDashboard(tab);

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
        sceneContext={dashboard}
        repeat={tab.getRepeatVariable()}
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
              'https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/create-dashboard/#configure-repeating-tabs'
            }
          >
            <Trans i18nKey="dashboard.tabs-layout.tab.repeat.learn-more">Learn more</Trans>
          </TextLink>
        </Alert>
      ) : undefined}
    </>
  );
}
