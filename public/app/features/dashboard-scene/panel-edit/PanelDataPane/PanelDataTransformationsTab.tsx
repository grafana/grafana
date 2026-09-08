import { DragDropContext, type DropResult, Droppable } from '@hello-pangea/dnd';
import { throttle } from 'lodash';
import { useCallback, useMemo, useState } from 'react';

import {
  type DataFrame,
  type DataTransformerConfig,
  type PanelData,
  type ResolvedSystemTransformations,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import {
  type SceneComponentProps,
  SceneDataTransformer,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneQueryRunner,
  type VizPanel,
} from '@grafana/scenes';
import { Tab } from '@grafana/ui';
import { TransformationOperationRows } from 'app/features/dashboard/components/TransformationsEditor/TransformationOperationRows';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { getResolvedSystemTransformations } from '../../scene/systemTransformations';
import { getQueryRunnerFor } from '../../utils/utils';
import {
  type TransformationConfigs,
  useTransformedFrames,
} from '../PanelEditNext/QueryEditor/hooks/useTransformedFrames';
import { TRANSFORMATION_EDIT_INTERACTION_THROTTLE_TIME } from '../PanelEditNext/constants';

import { EmptyTransformationsMessage } from './EmptyTransformationsMessage';
import { PanelDataPane } from './PanelDataPane';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { SystemTransformationRows } from './SystemTransformationRows';
import { TransformationsActions } from './TransformationsActions';
import { TransformationsDrawer } from './TransformationsDrawer';
import { type PanelDataPaneTab, type PanelDataTabHeaderProps, TabId } from './types';

const NO_FRAMES: DataFrame[] = [];

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
 * The query result with the plugin's *prepended* transformations applied.
 */
function useSystemTransformedData(
  sourceData: PanelData | undefined,
  systemTransformations: TransformationConfigs
): PanelData | undefined {
  const series = useTransformedFrames(systemTransformations, sourceData?.series ?? NO_FRAMES);

  return useMemo(() => {
    if (!sourceData || systemTransformations.length === 0) {
      return sourceData;
    }

    return { ...sourceData, series };
  }, [sourceData, systemTransformations, series]);
}

export function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  const sourceData = model.getQueryRunner().useState();
  const { data, transformations: transformsWrongType } = model.getDataTransformer().useState();

  // No `useMemo`: the provider's memo already makes this identity stable.
  const { prepend: systemPrepend, append: systemAppend } = model.getResolvedSystemTransformations();

  const editorData = useSystemTransformedData(sourceData.data, systemPrepend);

  // Type guard to ensure transformations are DataTransformerConfig[]
  const transformations = useMemo<DataTransformerConfig[]>(() => {
    const all = Array.isArray(transformsWrongType) ? transformsWrongType : [];

    return all.filter(
      (t): t is DataTransformerConfig => t !== null && typeof t === 'object' && 'id' in t && typeof t.id === 'string'
    );
  }, [transformsWrongType]);

  // What the picker judges a transformation's applicability against has to be what the row it adds
  // will receive: the prepended stage and every user transformation
  const drawerSeries = useTransformedFrames(transformations, editorData?.series ?? NO_FRAMES);

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

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
      series={drawerSeries}
    />
  );

  const hasUserTransformations = transformations.length > 0;

  return (
    <>
      <SystemTransformationRows transformations={systemPrepend} position="prepend" />
      {hasUserTransformations ? (
        <TransformationsEditor data={editorData} transformations={transformations} model={model} />
      ) : (
        // Uneditable transforms are functionally empty to the user
        <EmptyTransformationsMessage
          onShowPicker={openDrawer}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={editorData.series}
          datasourceUid={sourceData.datasource?.uid}
          queries={sourceData.queries}
        />
      )}
      <SystemTransformationRows transformations={systemAppend} position="append" />
      {hasUserTransformations && (
        <TransformationsActions
          onAddTransformation={openDrawer}
          onDeleteAll={() => model.onChangeTransformations([])}
        />
      )}
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
