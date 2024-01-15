import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';

import { DataTransformerConfig, IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps, SceneDataTransformer } from '@grafana/scenes';
import { Container, CustomScrollbar } from '@grafana/ui';
import { TransformationOperationRows } from 'app/features/dashboard/components/TransformationsEditor/TransformationOperationRows';

import { VizPanelManager } from '../../VizPanelManager';
import { PanelDataPaneTabState, PanelDataPaneTab } from '../types';

import { EmptyTransformationsMessage } from './EmptyTransformationsMessage';

interface PanelDataTransformationsTabState extends PanelDataPaneTabState {}

export class PanelDataTransformationsTab
  extends SceneObjectBase<PanelDataTransformationsTabState>
  implements PanelDataPaneTab
{
  static Component = PanelDataTransformationsTabRendered;
  tabId = 'transformations';
  icon: IconName = 'process';
  private _panelManager: VizPanelManager;

  getTabLabel() {
    return 'Transformations';
  }

  getItemsCount() {
    const dataProvider = this._panelManager.state.panel.state.$data;
    if (dataProvider instanceof SceneDataTransformer) {
      return dataProvider.state.transformations.length;
    } else {
      return 0;
    }
  }

  constructor(panelManager: VizPanelManager) {
    super({});

    this._panelManager = panelManager;
  }

  get panelManager() {
    return this._panelManager;
  }
}

interface TransformationEditorProps {
  sceneDataTransformer: SceneDataTransformer;
  onChange: (transformations: DataTransformerConfig[]) => void;
}

function TransformationsEditor(props: TransformationEditorProps) {
  const { onChange } = props;
  const dataState = props.sceneDataTransformer.useState();

  const transformations: DataTransformerConfig[] = [];

  for (const t of dataState.transformations) {
    if ('id' in t) {
      transformations.push(t);
    }
  }

  const transformationEditorRows = transformations.map((t, i) => ({ id: `${i} - ${t.id}`, transformation: t }));

  return (
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="transformations-list" direction="vertical">
        {(provided) => {
          return (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <TransformationOperationRows
                onChange={(index, transformation) => {
                  const newTransformations = transformations.slice();
                  newTransformations[index] = transformation;
                  onChange(newTransformations);
                }}
                onRemove={(index) => {
                  const newTransformations = transformations.slice();
                  newTransformations.splice(index);
                  onChange(newTransformations);
                }}
                configs={transformationEditorRows}
                data={{
                  series: dataState.data?.series || [],
                  annotations: dataState.data?.annotations || [],
                }}
              ></TransformationOperationRows>
              {provided.placeholder}
            </div>
          );
        }}
      </Droppable>
    </DragDropContext>
  );
}

export function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  const panelManagerState = model.panelManager.useState();
  const panelState = panelManagerState.panel.useState();

  if (!(panelState.$data instanceof SceneDataTransformer)) {
    return;
  }

  const dataState = panelState.$data.useState();

  return (
    <CustomScrollbar autoHeightMin="100%">
      <Container>
        {dataState.transformations.length < 1 ? (
          <EmptyTransformationsMessage onShowPicker={() => {}}></EmptyTransformationsMessage>
        ) : (
          <TransformationsEditor
            onChange={(transformations) => {
              model.panelManager.changeTransformations(transformations);
            }}
            sceneDataTransformer={panelState.$data}
          ></TransformationsEditor>
        )}
      </Container>
    </CustomScrollbar>
  );
}
