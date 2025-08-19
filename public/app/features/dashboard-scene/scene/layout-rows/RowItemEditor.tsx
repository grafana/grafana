import { useId, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Alert, Input, Switch, TextLink, Field } from '@grafana/ui';
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

export function useEditOptions(model: RowItem, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const { layout } = model.useState();

  const rowCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({ title: '', id: 'row-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            skipField: true,
            render: () => <RowTitleInput row={model} isNewElement={isNewElement} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.rows-layout.row-options.row.fill-screen', 'Fill screen'),
            id: uuidv4(),
            render: (descriptor) => <FillScreenSwitch id={descriptor.props.id} row={model} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.rows-layout.row-options.row.hide-header', 'Hide row header'),
            id: uuidv4(),
            render: (descriptor) => <RowHeaderSwitch id={descriptor.props.id} row={model} />,
          })
        ),
    [model, isNewElement]
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
          id: uuidv4(),
          description: t(
            'dashboard.rows-layout.row-options.repeat.variable.description',
            'Repeat this row for each value in the selected variable.'
          ),
          render: (descriptor) => <RowRepeatSelect id={descriptor.props.id} row={model} />,
        })
      ),
    [model]
  );

  const layoutCategory = useLayoutCategory(layout);

  const editOptions = [rowCategory, ...layoutCategory, repeatCategory];

  const conditionalRenderingCategory = useMemo(
    () => useConditionalRenderingEditor(model.state.conditionalRendering),
    [model]
  );

  if (conditionalRenderingCategory) {
    editOptions.push(conditionalRenderingCategory);
  }

  return editOptions;
}

function RowTitleInput({ row, isNewElement }: { row: RowItem; isNewElement: boolean }) {
  const { title } = row.useState();

  const ref = useEditPaneInputAutoFocus({ autoFocus: isNewElement });
  const hasUniqueTitle = row.hasUniqueTitle();

  return (
    <Field
      label={t('dashboard.rows-layout.row-options.row.title', 'Title')}
      invalid={!hasUniqueTitle}
      error={
        !hasUniqueTitle ? t('dashboard.rows-layout.row-options.title-not-unique', 'Title should be unique') : undefined
      }
    >
      <Input
        id={useId()}
        ref={ref}
        title={t('dashboard.rows-layout.row-options.title-option', 'Title')}
        value={title}
        onChange={(e) => row.onChangeTitle(e.currentTarget.value)}
      />
    </Field>
  );
}

function RowHeaderSwitch({ row, id }: { row: RowItem; id?: string }) {
  const { hideHeader: isHeaderHidden = false } = row.useState();

  return <Switch id={id} value={isHeaderHidden} onChange={() => row.onHeaderHiddenToggle()} />;
}

function FillScreenSwitch({ row, id }: { row: RowItem; id?: string }) {
  const { fillScreen } = row.useState();

  return <Switch id={id} value={fillScreen} onChange={() => row.onChangeFillScreen(!fillScreen)} />;
}

function RowRepeatSelect({ row, id }: { row: RowItem; id?: string }) {
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
        id={id}
        sceneContext={dashboard}
        repeat={row.state.repeatByVariable}
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
