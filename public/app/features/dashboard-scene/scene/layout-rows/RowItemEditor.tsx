import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, Input, RadioButtonGroup, Switch, TextLink } from '@grafana/ui';
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

import { RowItem } from './RowItem';

export function getEditOptions(model: RowItem): OptionsPaneCategoryDescriptor[] {
  const { layout } = model.useState();

  const rowCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({ title: '', id: 'row-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.rows-layout.row-options.row.title', 'Title'),
            render: () => <RowTitleInput row={model} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.rows-layout.row-options.row.height', 'Height'),
            render: () => <RowHeightSelect row={model} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.rows-layout.row-options.row.hide-header', 'Hide row header'),
            render: () => <RowHeaderSwitch row={model} />,
          })
        ),
    [model]
  );

  const repeatCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.rows-layout.row-options.repeat.title', 'Repeat options'),
        id: 'repeat-options',
        isOpenDefault: false,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.rows-layout.row-options.repeat.variable.title', 'Repeat by variable'),
          description: t(
            'dashboard.rows-layout.row-options.repeat.variable.description',
            'Repeat this row for each value in the selected variable.'
          ),
          render: () => <RowRepeatSelect row={model} />,
        })
      ),
    [model]
  );

  const layoutCategory = useLayoutCategory(layout);

  const editOptions = [rowCategory, layoutCategory, repeatCategory];

  const conditionalRenderingCategory = useMemo(
    () => useConditionalRenderingEditor(model.state.conditionalRendering),
    [model]
  );

  if (conditionalRenderingCategory) {
    editOptions.push(conditionalRenderingCategory);
  }

  return editOptions;
}

function RowTitleInput({ row }: { row: RowItem }) {
  const { title } = row.useState();
  const ref = useEditPaneInputAutoFocus();

  return (
    <Input
      ref={ref}
      title={t('dashboard.rows-layout.row-options.title-option', 'Title')}
      value={title}
      onChange={(e) => row.onChangeTitle(e.currentTarget.value)}
    />
  );
}

function RowHeaderSwitch({ row }: { row: RowItem }) {
  const { isHeaderHidden = false } = row.useState();

  return <Switch value={isHeaderHidden} onChange={() => row.onHeaderHiddenToggle()} />;
}

function RowHeightSelect({ row }: { row: RowItem }) {
  const { height = 'min' } = row.useState();

  const options: Array<SelectableValue<'expand' | 'min'>> = [
    { label: t('dashboard.rows-layout.options.height-expand', 'Expand'), value: 'expand' },
    { label: t('dashboard.rows-layout.options.height-min', 'Min'), value: 'min' },
  ];

  return <RadioButtonGroup options={options} value={height} onChange={(option) => row.onChangeHeight(option)} />;
}

function RowRepeatSelect({ row }: { row: RowItem }) {
  const { layout } = row.useState();
  const dashboard = useDashboard(row);

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
        repeat={row.getRepeatVariable()}
        onChange={(repeat) => row.onChangeRepeat(repeat)}
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
            <Trans i18nKey="dashboard.rows-layout.row.repeat.warning">
              Panels in this row use the {{ SHARED_DASHBOARD_QUERY }} data source. These panels will reference the panel
              in the original row, not the ones in the repeated rows.
            </Trans>
          </p>
          <TextLink
            external
            href={
              'https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows'
            }
          >
            <Trans i18nKey="dashboard.rows-layout.row.repeat.learn-more">Learn more</Trans>
          </TextLink>
        </Alert>
      ) : undefined}
    </>
  );
}
