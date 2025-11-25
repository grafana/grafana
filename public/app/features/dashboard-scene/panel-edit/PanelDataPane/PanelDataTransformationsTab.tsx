import { css } from '@emotion/css';
import { DragDropContext, DropResult, Droppable } from '@hello-pangea/dnd';
import { useCallback, useMemo, useState } from 'react';

import { DataTransformerConfig, GrafanaTheme2, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import {
  SceneObjectBase,
  SceneComponentProps,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneObjectRef,
  VizPanel,
  SceneObjectState,
} from '@grafana/scenes';
import { Button, ButtonGroup, ConfirmModal, Tab, useStyles2 } from '@grafana/ui';
import { TransformationOperationRows } from 'app/features/dashboard/components/TransformationsEditor/TransformationOperationRows';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';

import { EmptyTransformationsMessage } from './EmptyTransformationsMessage';
import { PanelDataPane } from './PanelDataPane';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { TransformationsDrawer } from './TransformationsDrawer';
import { PanelDataPaneTab, TabId, PanelDataTabHeaderProps } from './types';
import { usePersistedTransformationState } from './usePersistedTransformationState';
import { findSqlExpression, scrollToQueryRow } from './utils';

const SET_TIMEOUT = 750;

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
}

export function PanelDataTransformationsTabRendered({ model }: SceneComponentProps<PanelDataTransformationsTab>) {
  const styles = useStyles2(getStyles);
  const sourceData = model.getQueryRunner().useState();
  const { data, transformations: transformsWrongType } = model.getDataTransformer().useState();

  // Get dashboard and panel IDs for scoping session storage
  const dashboard = getDashboardSceneFor(model);
  const panel = model.state.panelRef.resolve();
  const storageKey = `${dashboard.state.uid}-${panel.state.key || 'unknown'}`;

  // Type guard to ensure transformations are DataTransformerConfig[]
  const transformations = useMemo<DataTransformerConfig[]>(() => {
    return Array.isArray(transformsWrongType)
      ? transformsWrongType.filter(
          (t): t is DataTransformerConfig =>
            t !== null && typeof t === 'object' && 'id' in t && typeof t.id === 'string'
        )
      : [];
  }, [transformsWrongType]);

  const { isOpen: getRowCollapseState, setIsOpen: setRowCollapseState } = usePersistedTransformationState(storageKey);

  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [pickerDrawerOpen, setPickerDrawerOpen] = useState<boolean>(false);

  const openPickerDrawer = () => setPickerDrawerOpen(true);
  const closePickerDrawer = () => setPickerDrawerOpen(false);

  const onGoToQueries = useCallback(() => {
    const parent = model.parent;
    if (!(parent instanceof PanelDataPane)) {
      return;
    }

    const queriesTab = parent.state.tabs.find((tab) => tab.tabId === TabId.Queries);
    if (!(queriesTab instanceof PanelDataQueriesTab)) {
      return;
    }

    const queries = queriesTab.getQueries();
    const existingSqlQuery = findSqlExpression(queries);

    if (!existingSqlQuery) {
      // Create new SQL expression
      queriesTab.onAddExpressionOfType(ExpressionQueryType.sql);
    }

    // Navigate to the Queries tab
    parent.onChangeTab(queriesTab);

    // Scroll to SQL query after tab renders
    setTimeout(() => {
      // If SQL already existed, use it; otherwise find the newly created one
      const targetRefId = existingSqlQuery?.refId || findSqlExpression(queriesTab.getQueries())?.refId;
      if (targetRefId) {
        scrollToQueryRow(targetRefId);
      }
    }, SET_TIMEOUT);
  }, [model]);

  const onAddTransformation = useCallback(
    (transformationId: string) => {
      model.onChangeTransformations([...transformations, { id: transformationId, options: {} }]);
    },
    [model, transformations]
  );

  if (!data || !sourceData.data) {
    return;
  }

  const transformationsDrawer = (
    <TransformationsDrawer
      onClose={closePickerDrawer}
      onTransformationAdd={(selected) => {
        if (selected.value === undefined) {
          return;
        }
        model.onChangeTransformations([...transformations, { id: selected.value, options: {} }]);
        closePickerDrawer();
      }}
      isOpen={pickerDrawerOpen}
      series={data.series}
    />
  );

  if (transformations.length < 1) {
    return (
      <>
        <EmptyTransformationsMessage
          onShowPicker={openPickerDrawer}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
        />
        {transformationsDrawer}
      </>
    );
  }

  return (
    <>
      <TransformationsEditor
        data={sourceData.data}
        transformations={transformations}
        model={model}
        getIsOpen={getRowCollapseState}
        setIsOpen={setRowCollapseState}
      />
      <ButtonGroup>
        <Button
          icon="plus"
          variant="secondary"
          onClick={openPickerDrawer}
          data-testid={selectors.components.Transforms.addTransformationButton}
        >
          <Trans i18nKey="dashboard-scene.panel-data-transformations-tab-rendered.add-another-transformation">
            Add another transformation
          </Trans>
        </Button>
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
  getIsOpen: (id: string) => boolean | undefined;
  setIsOpen: (id: string, isOpen: boolean) => void;
}

function TransformationsEditor({ transformations, model, data, getIsOpen, setIsOpen }: TransformationEditorProps) {
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
                getIsOpen={getIsOpen}
                setIsOpen={setIsOpen}
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
      label={model.getTabLabel()}
      icon="process"
      counter={transformerState.transformations.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
