import { css } from '@emotion/css';
import { DragDropContext, type DropResult, Droppable } from '@hello-pangea/dnd';
import { throttle } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type CustomTransformOperator,
  type DataTransformContext,
  type DataTransformerConfig,
  type GrafanaTheme2,
  type PanelData,
  type ResolvedSystemTransformations,
  transformDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';
import {
  type SceneComponentProps,
  SceneDataTransformer,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneQueryRunner,
  type SystemTransformationPosition,
  type VizPanel,
} from '@grafana/scenes';
import { Button, ButtonGroup, ConfirmModal, Icon, Tab, useStyles2 } from '@grafana/ui';
import { TransformationOperationRows } from 'app/features/dashboard/components/TransformationsEditor/TransformationOperationRows';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { getResolvedSystemTransformations } from '../../scene/systemTransformations';
import { getQueryRunnerFor } from '../../utils/utils';
import { TRANSFORMATION_EDIT_INTERACTION_THROTTLE_TIME } from '../PanelEditNext/constants';
import {
  SystemTransformationBadge,
  getSystemTransformationName,
  getSystemTransformationsGroupLabel,
} from '../systemTransformationDisplay';

import { EmptyTransformationsMessage } from './EmptyTransformationsMessage';
import { PanelDataPane } from './PanelDataPane';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { TransformationsDrawer } from './TransformationsDrawer';
import { type PanelDataPaneTab, type PanelDataTabHeaderProps, TabId } from './types';

const reportTransformationEditInteraction = throttle((context: string, type: string) => {
  reportInteraction('grafana_panel_transformations_clicked', {
    context,
    type,
    action: 'edit',
  });
}, TRANSFORMATION_EDIT_INTERACTION_THROTTLE_TIME);

interface PanelDataTransformationsTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelDataTransformationsTab
  extends SceneObjectBase<PanelDataTransformationsTabState>
  implements PanelDataPaneTab
{
  static Component = PanelDataTransformationsTabRendered;
  tabId = TabId.Transformations;

  getTabLabel() {
    return t('dashboard-scene.panel-data-transformations-tab.tab-label', 'Transformations');
  }

  public renderTab(props: PanelDataTabHeaderProps) {
    return <TransformationsTab key={this.getTabLabel()} model={this} {...props} />;
  }

  public getQueryRunner(): SceneQueryRunner {
    return getQueryRunnerFor(this.state.panelRef.resolve())!;
  }

  public getDataTransformer(): SceneDataTransformer {
    const provider = this.state.panelRef.resolve().state.$data;

    if (!provider || !(provider instanceof SceneDataTransformer)) {
      throw new Error('Could not find SceneDataTransformer for panel');
    }
    return provider;
  }

  public onChangeTransformations(transformations: DataTransformerConfig[]) {
    const transformer = this.getDataTransformer();
    transformer.setState({ transformations });
    transformer.reprocessTransformations();
  }

  public getResolvedSystemTransformations(): ResolvedSystemTransformations {
    return getResolvedSystemTransformations(this.getDataTransformer());
  }
}

/**
 * The query result with the plugin's *prepended* transformations applied. Editor rows replay the
 * user transformations over this, so it has to include the plugin's stage or each row is configured
 * against a field shape it will never receive. Appended ones run after every user transformation, so
 * they are part of no row's input.
 */
function useSystemTransformedData(
  sourceData: PanelData | undefined,
  systemTransformations: Array<DataTransformerConfig | CustomTransformOperator>
): PanelData | undefined {
  const sourceSeries = sourceData?.series;
  const [series, setSeries] = useState(sourceSeries);
  const hasSystemTransformations = systemTransformations.length > 0;

  useEffect(() => {
    if (!hasSystemTransformations || !sourceSeries) {
      return;
    }

    const ctx: DataTransformContext = { interpolate: (v: string) => getTemplateSrv().replace(v) };
    const subscription = transformDataFrame(systemTransformations, sourceSeries, ctx).subscribe(setSeries);

    return () => subscription.unsubscribe();
  }, [hasSystemTransformations, systemTransformations, sourceSeries]);

  // `data` is an effect dep of every editor row, so a fresh object each render re-runs their replays.
  return useMemo(() => {
    if (!sourceData || !hasSystemTransformations || !series) {
      return sourceData;
    }

    return { ...sourceData, series };
  }, [sourceData, hasSystemTransformations, series]);
}

export function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  const styles = useStyles2(getStyles);
  const sourceData = model.getQueryRunner().useState();
  const { data, transformations: transformsWrongType } = model.getDataTransformer().useState();

  // No `useMemo`: the provider's memo already makes this identity stable.
  const { prepend: systemPrepend, append: systemAppend } = model.getResolvedSystemTransformations();
  const hasSystemTransformations = systemPrepend.length > 0 || systemAppend.length > 0;

  const editorData = useSystemTransformedData(sourceData.data, systemPrepend);

  // Type guard to ensure transformations are DataTransformerConfig[]
  const transformations = useMemo<DataTransformerConfig[]>(() => {
    const all = Array.isArray(transformsWrongType) ? transformsWrongType : [];

    return all.filter(
      (t): t is DataTransformerConfig => t !== null && typeof t === 'object' && 'id' in t && typeof t.id === 'string'
    );
  }, [transformsWrongType]);

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  const onGoToQueries = useCallback(() => {
    const parent = model.parent;
    if (!(parent instanceof PanelDataPane)) {
      return;
    }

    const queriesTab = parent.state.tabs.find((tab) => tab.tabId === TabId.Queries);
    if (!(queriesTab instanceof PanelDataQueriesTab)) {
      return;
    }

    // Always create a new SQL expression (it will be added to the end of the queries array)
    const refId = queriesTab.onAddExpressionOfType(ExpressionQueryType.sql);

    // Navigate to the Queries tab. The tab renders asynchronously (datasource loading),
    // so the new query row scrolls itself into view once it appears, driven by this state.
    parent.onChangeTab(queriesTab);
    queriesTab.setState({ scrollToRefId: refId });
  }, [model]);

  const onAddTransformation = useCallback(
    (transformationId: string) => {
      model.onChangeTransformations([...transformations, { id: transformationId, options: {} }]);
    },
    [model, transformations]
  );

  if (!data || !editorData) {
    return;
  }

  const transformationsDrawer = (
    <TransformationsDrawer
      onClose={closeDrawer}
      onTransformationAdd={(selected) => {
        if (selected.value === undefined) {
          return;
        }
        model.onChangeTransformations([...transformations, { id: selected.value, options: {} }]);
        closeDrawer();
      }}
      isOpen={drawerOpen}
      series={data.series}
    />
  );

  if (transformations.length < 1 && !hasSystemTransformations) {
    return (
      <>
        <EmptyTransformationsMessage
          onShowPicker={openDrawer}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={editorData.series}
          datasourceUid={sourceData.datasource?.uid}
          queries={sourceData.queries}
        />
        {transformationsDrawer}
      </>
    );
  }

  return (
    <>
      <SystemTransformationRows transformations={systemPrepend} position="prepend" />
      {transformations.length > 0 && (
        <TransformationsEditor data={editorData} transformations={transformations} model={model} />
      )}
      <SystemTransformationRows transformations={systemAppend} position="append" />
      <ButtonGroup>
        <Button
          icon="plus"
          variant="secondary"
          onClick={openDrawer}
          data-testid={selectors.components.Transforms.addTransformationButton}
        >
          <Trans i18nKey="dashboard-scene.panel-data-transformations-tab-rendered.add-another-transformation">
            Add another transformation
          </Trans>
        </Button>
        {transformations.length > 0 && (
          <Button
            data-testid={selectors.components.Transforms.removeAllTransformationsButton}
            className={styles.removeAll}
            icon="times"
            variant="secondary"
            onClick={() => setConfirmModalOpen(true)}
          >
            <Trans i18nKey="dashboard-scene.panel-data-transformations-tab-rendered.delete-all-transformations">
              Delete all transformations
            </Trans>
          </Button>
        )}
      </ButtonGroup>
      <ConfirmModal
        isOpen={confirmModalOpen}
        title={t(
          'dashboard-scene.panel-data-transformations-tab-rendered.title-delete-all-transformations',
          'Delete all transformations?'
        )}
        body={t(
          'dashboard-scene.panel-data-transformations-tab-rendered.body-delete-all-transformations',
          'By deleting all transformations, you will go back to the main selection screen.'
        )}
        confirmText={t('dashboard-scene.panel-data-transformations-tab-rendered.confirmText-delete-all', 'Delete all')}
        onConfirm={() => {
          reportInteraction('grafana_panel_transformations_clicked', {
            context: 'transformations_list',
            action: 'delete_all',
          });
          model.onChangeTransformations([]);
          setConfirmModalOpen(false);
        }}
        onDismiss={() => setConfirmModalOpen(false)}
      />
      {transformationsDrawer}
    </>
  );
}

interface TransformationEditorProps {
  transformations: DataTransformerConfig[];
  model: PanelDataTransformationsTab;
  data: PanelData;
}

function TransformationsEditor({ transformations, model, data }: TransformationEditorProps) {
  const transformationEditorRows = transformations.map((t, i) => ({ id: `${i} - ${t.id}`, transformation: t }));

  const onDragEnd = (result: DropResult) => {
    if (!result || !result.destination) {
      return;
    }

    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    if (startIndex === endIndex) {
      return;
    }
    const update = Array.from(transformationEditorRows);
    const [removed] = update.splice(startIndex, 1);
    update.splice(endIndex, 0, removed);
    model.onChangeTransformations(update.map((t) => t.transformation));
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="transformations-list" direction="vertical">
        {(provided) => {
          return (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <TransformationOperationRows
                onChange={(index, transformation) => {
                  if (transformation?.id) {
                    reportTransformationEditInteraction('transformations_list', transformation.id);
                  }
                  const newTransformations = transformations.slice();
                  newTransformations[index] = transformation;
                  model.onChangeTransformations(newTransformations);
                }}
                onRemove={(index) => {
                  const removed = transformations[index];
                  if (removed?.id) {
                    reportInteraction('grafana_panel_transformations_clicked', {
                      context: 'transformations_list',
                      type: removed.id,
                      action: 'delete',
                      total_transformations: transformations.length - 1,
                    });
                  }
                  const newTransformations = transformations.slice();
                  newTransformations.splice(index, 1);
                  model.onChangeTransformations(newTransformations);
                }}
                configs={transformationEditorRows}
                data={data}
              ></TransformationOperationRows>
              {provided.placeholder}
            </div>
          );
        }}
      </Droppable>
    </DragDropContext>
  );
}

interface SystemTransformationRowsProps {
  transformations: Array<DataTransformerConfig | CustomTransformOperator>;
  position: SystemTransformationPosition;
}

function SystemTransformationRows({ transformations, position }: SystemTransformationRowsProps) {
  const styles = useStyles2(getStyles);

  if (transformations.length === 0) {
    return null;
  }

  return (
    <ul className={styles.systemRows} aria-label={getSystemTransformationsGroupLabel(position)}>
      {transformations.map((transformation, index) => {
        const id = typeof transformation === 'function' ? undefined : transformation.id;

        return (
          <li
            key={`${id ?? 'custom'}-${index}`}
            className={styles.systemRow}
            data-testid={selectors.components.Transforms.systemTransformationRow}
          >
            {/* Decorative — `SystemTransformationBadge` carries the same meaning as text. */}
            <Icon name="lock" size="sm" />
            <span className={styles.systemRowName}>{getSystemTransformationName(transformation)}</span>
            <SystemTransformationBadge />
          </li>
        );
      })}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  removeAll: css({
    marginLeft: theme.spacing(2),
  }),
  systemRows: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  systemRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1, 1, 2),
    marginBottom: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
  }),
  systemRowName: css({
    flexGrow: 1,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});

interface TransformationsTabProps extends PanelDataTabHeaderProps {
  model: PanelDataTransformationsTab;
}

function TransformationsTab(props: TransformationsTabProps) {
  const { model } = props;
  const transformerState = model.getDataTransformer().useState();

  return (
    <Tab
      label={model.getTabLabel()}
      icon="process"
      counter={transformerState.transformations.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
