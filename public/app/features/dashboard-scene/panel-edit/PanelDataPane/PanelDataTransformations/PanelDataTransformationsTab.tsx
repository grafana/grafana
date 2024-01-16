import { css } from '@emotion/css';
import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';

import { DataTransformerConfig, GrafanaTheme2, IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneObjectBase, SceneComponentProps, SceneDataTransformer } from '@grafana/scenes';
import { Button, ButtonGroup, ConfirmModal, Container, CustomScrollbar, useStyles2 } from '@grafana/ui';
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
      return null;
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
    // We can't have any CustomTransformerOperators in the panel editor. This get's rid of them and fixes the type.
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
  const styles = useStyles2(getStyles);
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
          <>
            <TransformationsEditor
              onChange={(transformations) => {
                model.panelManager.changeTransformations(transformations);
              }}
              sceneDataTransformer={panelState.$data}
            ></TransformationsEditor>
            <ButtonGroup>
              <Button
                icon="plus"
                variant="secondary"
                onClick={() => {}}
                data-testid={selectors.components.Transforms.addTransformationButton}
              >
                Add another transformation
              </Button>
              <Button className={styles.removeAll} icon="times" variant="secondary" onClick={() => {}}>
                Delete all transformations
              </Button>
            </ButtonGroup>
            <ConfirmModal
              isOpen={false}
              title="Delete all transformations?"
              body="By deleting all transformations, you will go back to the main selection screen."
              confirmText="Delete all"
              onConfirm={() => {}}
              onDismiss={() => {}}
            />
          </>
        )}
      </Container>
    </CustomScrollbar>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  removeAll: css({
    marginLeft: theme.spacing(2),
  }),
});
