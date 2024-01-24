import { css } from '@emotion/css';
import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';

import { DataTransformerConfig, GrafanaTheme2, IconName, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneObjectBase, SceneComponentProps, SceneDataTransformer } from '@grafana/scenes';
import { Button, ButtonGroup, ConfirmModal, useStyles2 } from '@grafana/ui';
import { TransformationOperationRows } from 'app/features/dashboard/components/TransformationsEditor/TransformationOperationRows';

import { VizPanelManager } from '../VizPanelManager';

import { EmptyTransformationsMessage } from './EmptyTransformationsMessage';
import { PanelDataPaneTabState, PanelDataPaneTab } from './types';

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
    return this.getDataTransformer().state.transformations.length;
  }

  constructor(panelManager: VizPanelManager) {
    super({});

    this._panelManager = panelManager;
  }

  public getDataTransformer(): SceneDataTransformer {
    const provider = this._panelManager.state.panel.state.$data;
    if (!provider || !(provider instanceof SceneDataTransformer)) {
      throw new Error('Could not find SceneDataTransformer for panel');
    }

    return provider;
  }

  public changeTransformations(transformations: DataTransformerConfig[]) {
    const dataProvider = this.getDataTransformer();
    dataProvider.setState({ transformations });
    dataProvider.reprocessTransformations();
  }
}

export function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  const styles = useStyles2(getStyles);
  const { data, transformations: transformsWrongType } = model.getDataTransformer().useState();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const transformations: DataTransformerConfig[] = transformsWrongType as unknown as DataTransformerConfig[];

  if (transformations.length < 1) {
    return <EmptyTransformationsMessage onShowPicker={() => {}}></EmptyTransformationsMessage>;
  }

  if (!data) {
    return;
  }

  return (
    <>
      <TransformationsEditor data={data} transformations={transformations} model={model} />
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
  );
}

interface TransformationEditorProps {
  transformations: DataTransformerConfig[];
  model: PanelDataTransformationsTab;
  data: PanelData;
}

function TransformationsEditor({ transformations, model, data }: TransformationEditorProps) {
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
                  model.changeTransformations(newTransformations);
                }}
                onRemove={(index) => {
                  const newTransformations = transformations.slice();
                  newTransformations.splice(index);
                  model.changeTransformations(newTransformations);
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

const getStyles = (theme: GrafanaTheme2) => ({
  removeAll: css({
    marginLeft: theme.spacing(2),
  }),
});
