import { css } from '@emotion/css';
import { DragDropContext, DropResult, Droppable } from '@hello-pangea/dnd';
import { useState } from 'react';

import { DataTransformerConfig, GrafanaTheme2, IconName, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneObjectBase, SceneComponentProps, SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { Button, ButtonGroup, ConfirmModal, Tab, useStyles2 } from '@grafana/ui';
import { TransformationOperationRows } from 'app/features/dashboard/components/TransformationsEditor/TransformationOperationRows';

import { VizPanelManager } from '../VizPanelManager';

import { EmptyTransformationsMessage } from './EmptyTransformationsMessage';
import { TransformationsDrawer } from './TransformationsDrawer';
import { PanelDataPaneTabState, PanelDataPaneTab, TabId, PanelDataTabHeaderProps } from './types';

interface PanelDataTransformationsTabState extends PanelDataPaneTabState {}

export class PanelDataTransformationsTab
  extends SceneObjectBase<PanelDataTransformationsTabState>
  implements PanelDataPaneTab
{
  static Component = PanelDataTransformationsTabRendered;
  TabComponent: (props: PanelDataTabHeaderProps) => React.JSX.Element;

  tabId = TabId.Transformations;
  icon: IconName = 'process';
  private _panelManager: VizPanelManager;

  getTabLabel() {
    return 'Transformations';
  }

  constructor(panelManager: VizPanelManager) {
    super({});
    this.TabComponent = (props: PanelDataTabHeaderProps) => TransformationsTab({ ...props, model: this });

    this._panelManager = panelManager;
  }

  public getQueryRunner(): SceneQueryRunner {
    return this._panelManager.queryRunner;
  }

  public getDataTransformer(): SceneDataTransformer {
    return this._panelManager.dataTransformer;
  }

  public onChangeTransformations(transformations: DataTransformerConfig[]) {
    this._panelManager.changeTransformations(transformations);
  }

  get panelManager() {
    return this._panelManager;
  }
}

export function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  const styles = useStyles2(getStyles);
  const sourceData = model.getQueryRunner().useState();
  const { data, transformations: transformsWrongType } = model.getDataTransformer().useState();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const transformations: DataTransformerConfig[] = transformsWrongType as unknown as DataTransformerConfig[];

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  if (!data || !sourceData.data) {
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
    ></TransformationsDrawer>
  );

  if (transformations.length < 1) {
    return (
      <>
        <EmptyTransformationsMessage onShowPicker={openDrawer}></EmptyTransformationsMessage>
        {transformationsDrawer}
      </>
    );
  }

  return (
    <>
      <TransformationsEditor data={sourceData.data} transformations={transformations} model={model} />
      <ButtonGroup>
        <Button
          icon="plus"
          variant="secondary"
          onClick={openDrawer}
          data-testid={selectors.components.Transforms.addTransformationButton}
        >
          Add another transformation
        </Button>
        <Button
          data-testid={selectors.components.Transforms.removeAllTransformationsButton}
          className={styles.removeAll}
          icon="times"
          variant="secondary"
          onClick={() => setConfirmModalOpen(true)}
        >
          Delete all transformations
        </Button>
      </ButtonGroup>
      <ConfirmModal
        isOpen={confirmModalOpen}
        title="Delete all transformations?"
        body="By deleting all transformations, you will go back to the main selection screen."
        confirmText="Delete all"
        onConfirm={() => {
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
                  const newTransformations = transformations.slice();
                  newTransformations[index] = transformation;
                  model.onChangeTransformations(newTransformations);
                }}
                onRemove={(index) => {
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

const getStyles = (theme: GrafanaTheme2) => ({
  removeAll: css({
    marginLeft: theme.spacing(2),
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
      key={props.key}
      label={model.getTabLabel()}
      icon="process"
      counter={transformerState.transformations.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
