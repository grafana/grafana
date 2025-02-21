import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, Button, Input, RadioButtonGroup, Switch, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';

import { RowItem } from './RowItem';

export function getEditOptions(model: RowItem): OptionsPaneCategoryDescriptor[] {
  const rowOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.rows-layout.row-options.title', 'Row options'),
      id: 'row-options',
      isOpenDefault: true,
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.rows-layout.row-options.title-option', 'Title'),
          render: () => <RowTitleInput row={model} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.rows-layout.row-options.height.title', 'Height'),
          render: () => <RowHeightSelect row={model} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.rows-layout.row-options.height.hide-row-header', 'Hide row header'),
          render: () => <RowHeaderSwitch row={model} />,
        })
      );
  }, [model]);

  const rowRepeatOptions = useMemo(() => {
    const dashboard = getDashboardSceneFor(model);

    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.rows-layout.row-options.repeat.title', 'Repeat options'),
      id: 'row-repeat-options',
      isOpenDefault: true,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.rows-layout.row-options.repeat.variable.title', 'Variable'),
        render: () => <RowRepeatSelect row={model} dashboard={dashboard} />,
      })
    );
  }, [model]);

  const { layout } = model.useState();
  const layoutOptions = useLayoutCategory(layout);

  return [rowOptions, rowRepeatOptions, layoutOptions];
}

export function renderActions(model: RowItem) {
  return (
    <>
      <Button size="sm" variant="secondary" icon="copy" />
      <Button size="sm" variant="destructive" fill="outline" onClick={() => model.onDelete()} icon="trash-alt" />
    </>
  );
}

function RowTitleInput({ row }: { row: RowItem }) {
  const { title } = row.useState();

  return <Input value={title} onChange={(e) => row.onChangeTitle(e.currentTarget.value)} />;
}

function RowHeaderSwitch({ row }: { row: RowItem }) {
  const { isHeaderHidden = false } = row.useState();

  return <Switch value={isHeaderHidden} onChange={() => row.onHeaderHiddenToggle()} />;
}

function RowHeightSelect({ row }: { row: RowItem }) {
  const { height = 'expand' } = row.useState();

  const options: Array<SelectableValue<'expand' | 'min'>> = [
    { label: t('dashboard.rows-layout.row-options.height.expand', 'Expand'), value: 'expand' },
    { label: t('dashboard.rows-layout.row-options.height.min', 'Min'), value: 'min' },
  ];

  return <RadioButtonGroup options={options} value={height} onChange={(option) => row.onChangeHeight(option)} />;
}

function RowRepeatSelect({ row, dashboard }: { row: RowItem; dashboard: DashboardScene }) {
  const { layout } = row.useState();

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
