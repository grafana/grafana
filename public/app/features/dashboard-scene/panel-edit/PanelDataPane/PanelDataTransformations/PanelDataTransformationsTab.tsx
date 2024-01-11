import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';

import { IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps, SceneDataTransformer } from '@grafana/scenes';
import { Container, CustomScrollbar } from '@grafana/ui';
import { TransformationOperationRows } from 'app/features/dashboard/components/TransformationsEditor/TransformationOperationRows';
import { TransformationsEditorTransformation } from 'app/features/dashboard/components/TransformationsEditor/types';

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
    return null;
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
}

function TransformationsEditor(props: TransformationEditorProps) {
  const dataState = props.sceneDataTransformer.useState();
  const transformationEditorRows: TransformationsEditorTransformation[] = [];

  let i = 0; // Ids need to be unique for drag to change order to work
  for (const t of dataState.transformations) {
    if ('id' in t) {
      transformationEditorRows.push({ id: `${i} - ${t.id}`, transformation: t });
      i++;
    }
  }

  return (
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="transformations-list" direction="vertical">
        {(provided) => {
          return (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <TransformationOperationRows
                onChange={() => {}}
                onRemove={() => {}}
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
          <TransformationsEditor sceneDataTransformer={panelState.$data}></TransformationsEditor>
        )}
      </Container>
    </CustomScrollbar>
  );
}
