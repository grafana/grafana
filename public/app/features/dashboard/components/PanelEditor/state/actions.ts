import { DashboardModel, PanelModel } from '../../../state';
import { ThunkResult } from 'app/types';
import { appEvents } from 'app/core/core';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import {
  closeCompleted,
  PANEL_EDITOR_UI_STATE_STORAGE_KEY,
  PanelEditorUIState,
  setPanelEditorUIState,
  updateEditorInitState,
} from './reducers';
import { cleanUpEditPanel, panelModelAndPluginReady } from '../../../state/reducers';
import store from 'app/core/store';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import { locationService } from '@grafana/runtime';
import { ShowModalReactEvent } from '../../../../../types/events';

export function initPanelEditor(sourcePanel: PanelModel, dashboard: DashboardModel): ThunkResult<void> {
  return (dispatch) => {
    const panel = dashboard.initEditPanel(sourcePanel);

    dispatch(
      updateEditorInitState({
        panel,
        sourcePanel,
      })
    );
  };
}

export function updateSourcePanel(sourcePanel: PanelModel): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { getPanel } = getStore().panelEditor;

    dispatch(
      updateEditorInitState({
        panel: getPanel(),
        sourcePanel,
      })
    );
  };
}

export function exitPanelEditor(): ThunkResult<void> {
  return (dispatch, getStore) => {
    const dashboard = getStore().dashboard.getModel();
    const { getPanel, getSourcePanel, shouldDiscardChanges } = getStore().panelEditor;

    const onConfirm = () => locationService.partial({ editPanel: null, tab: null });

    const modifiedPanel = getPanel();
    const modifiedSaveModel = modifiedPanel.getSaveModel();
    const initialSaveModel = getSourcePanel().getSaveModel();
    const panelChanged = !isEqual(omit(initialSaveModel, 'id'), omit(modifiedSaveModel, 'id'));

    if (shouldDiscardChanges || !modifiedPanel.libraryPanel || !panelChanged) {
      onConfirm();
      return;
    }

    appEvents.publish(
      new ShowModalReactEvent({
        component: SaveLibraryPanelModal,
        props: {
          panel: modifiedPanel,
          folderId: dashboard!.meta.folderId,
          isOpen: true,
          onConfirm,
        },
      })
    );
  };
}

function updateDuplicateLibraryPanels(modifiedPanel: PanelModel, dashboard: DashboardModel, dispatch: any) {
  if (modifiedPanel.libraryPanel?.uid === undefined) {
    return;
  }

  const modifiedSaveModel = modifiedPanel.getSaveModel();
  for (const panel of dashboard.panels) {
    if (panel.libraryPanel?.uid !== modifiedPanel.libraryPanel!.uid) {
      continue;
    }

    panel.restoreModel({
      ...modifiedSaveModel,
      ...pick(panel, 'gridPos', 'id'),
    });

    // Loaded plugin is not included in the persisted properties
    // So is not handled by restoreModel
    panel.plugin = modifiedSaveModel.plugin;

    if (panel.type !== modifiedPanel.type) {
      dispatch(panelModelAndPluginReady({ panelId: panel.id, plugin: panel.plugin! }));
    }

    // Resend last query result on source panel query runner
    // But do this after the panel edit editor exit process has completed
    setTimeout(() => {
      panel.getQueryRunner().useLastResultFrom(modifiedPanel.getQueryRunner());
    }, 20);
  }
}

export function panelEditorCleanUp(): ThunkResult<void> {
  return (dispatch, getStore) => {
    const dashboard = getStore().dashboard.getModel();
    const { getPanel, getSourcePanel, shouldDiscardChanges } = getStore().panelEditor;

    if (!shouldDiscardChanges) {
      const panel = getPanel();
      const modifiedSaveModel = panel.getSaveModel();
      const sourcePanel = getSourcePanel();
      const panelTypeChanged = sourcePanel.type !== panel.type;

      updateDuplicateLibraryPanels(panel, dashboard!, dispatch);

      // restore the source panel id before we update source panel
      modifiedSaveModel.id = sourcePanel.id;

      sourcePanel.restoreModel(modifiedSaveModel);

      // Loaded plugin is not included in the persisted properties
      // So is not handled by restoreModel
      sourcePanel.plugin = panel.plugin;

      if (panelTypeChanged) {
        dispatch(panelModelAndPluginReady({ panelId: sourcePanel.id, plugin: panel.plugin! }));
      }

      // Resend last query result on source panel query runner
      // But do this after the panel edit editor exit process has completed
      setTimeout(() => {
        sourcePanel.getQueryRunner().useLastResultFrom(panel.getQueryRunner());
      }, 20);
    }

    if (dashboard) {
      dashboard.exitPanelEditor();
    }

    dispatch(cleanUpEditPanel());
    dispatch(closeCompleted());
  };
}

export function updatePanelEditorUIState(uiState: Partial<PanelEditorUIState>): ThunkResult<void> {
  return (dispatch, getStore) => {
    const nextState = { ...getStore().panelEditor.ui, ...uiState };
    dispatch(setPanelEditorUIState(nextState));
    try {
      store.setObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, nextState);
    } catch (error) {
      console.error(error);
    }
  };
}
