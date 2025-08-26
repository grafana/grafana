import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { sceneGraph, SceneGridRow, VizPanel } from '@grafana/scenes';
import { Alert, Input, TextLink } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { getDashboardSceneFor, getLayoutManagerFor, getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { BulkActionElement } from '../types/BulkActionElement';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';

import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';

function useEditPaneOptions(this: SceneGridRowEditableElement, row: SceneGridRow): OptionsPaneCategoryDescriptor[] {
  const rowOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.default-layout.row-options.title', 'Row options'),
      id: 'row-options',
      isOpenDefault: true,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.default-layout.row-options.form.title', 'Title'),
        render: () => <RowTitleInput row={row} />,
      })
    );
  }, [row]);

  const rowRepeatOptions = useMemo(() => {
    const dashboard = getDashboardSceneFor(row);

    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.default-layout.row-options.repeat.title', 'Repeat options'),
      id: 'row-repeat-options',
      isOpenDefault: true,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.default-layout.row-options.repeat.variable.title', 'Variable'),
        render: () => <RowRepeatSelect row={row} dashboard={dashboard} />,
      })
    );
  }, [row]);

  return [rowOptions, rowRepeatOptions];
}

export class SceneGridRowEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private _row: SceneGridRow) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.row', 'Row'),
      instanceName: sceneGraph.interpolate(this._row, this._row.state.title, undefined, 'text'),
      icon: 'list-ul',
    };
  }

  public getOutlineChildren() {
    return this._row.state.children;
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this._row);

  public onDelete() {
    const layoutManager = getLayoutManagerFor(this._row);

    if (layoutManager instanceof DefaultGridLayoutManager) {
      layoutManager.removeRow(this._row);
    }
  }
}

function RowTitleInput({ row }: { row: SceneGridRow }) {
  const { title } = row.useState();

  return <Input value={title} onChange={(e) => row.setState({ title: e.currentTarget.value })} />;
}

function RowRepeatSelect({ row, dashboard }: { row: SceneGridRow; dashboard: DashboardScene }) {
  const { $behaviors, children } = row.useState();
  let repeatBehavior = $behaviors?.find((b) => b instanceof RowRepeaterBehavior);
  const vizPanels = useMemo(
    () => children.reduce<VizPanel[]>((acc, child) => [...acc, ...sceneGraph.findDescendents(child, VizPanel)], []),
    [children]
  );

  const isAnyPanelUsingDashboardDS = vizPanels.some((vizPanel) => {
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
        repeat={repeatBehavior?.state.variableName}
        onChange={(repeat) => {
          if (repeat) {
            repeatBehavior?.removeBehavior();
            repeatBehavior = new RowRepeaterBehavior({ variableName: repeat });
            row.setState({ $behaviors: [...(row.state.$behaviors ?? []), repeatBehavior] });
          } else {
            repeatBehavior?.removeBehavior();
          }
        }}
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
            <Trans i18nKey="dashboard.default-layout.row-options.form.repeat-for.warning.text">
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
            <Trans i18nKey="dashboard.default-layout.row-options.form.repeat-for.learn-more">Learn more</Trans>
          </TextLink>
        </Alert>
      ) : undefined}
    </>
  );
}
