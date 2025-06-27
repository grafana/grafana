import { type AddCallbackFunction, type DashboardOperations } from '@grafana/assistant';
import { usePluginFunctions } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

const getDashboardScene = (): DashboardScene | null =>
  window.__grafanaSceneContext instanceof DashboardScene ? window.__grafanaSceneContext : null;

export const RegisterAssistantDashboardFunctions = () => {
  // get all exposed functions from the assistant plugin
  const { functions: assistantFunctions } = usePluginFunctions<AddCallbackFunction>({
    extensionPointId: 'grafana/grafana-assistant-app/add-callback-function/v0-alpha',
  });

  const dashboardActions: DashboardOperations = {
    addPanel: (vizPanel: VizPanel) => getDashboardScene()?.addPanel(vizPanel),
    duplicatePanel: (vizPanel: VizPanel) => getDashboardScene()?.duplicatePanel(vizPanel),
    copyPanel: (vizPanel: VizPanel) => getDashboardScene()?.copyPanel(vizPanel),
    pastePanel: () => getDashboardScene()?.pastePanel(),
    removePanel: (panel: VizPanel) => getDashboardScene()?.removePanel(panel),
    createNewPanel: () => getDashboardScene()?.onCreateNewPanel(),
    createNewRow: () => getDashboardScene()?.onCreateNewRow(),
    onEnterEditMode: () => getDashboardScene()?.onEnterEditMode(),
    openSaveDrawer: (options?: { saveAsCopy?: boolean; onSaveSuccess?: () => void }) =>
      getDashboardScene()?.openSaveDrawer(options || {}),
    onStarDashboard: () => getDashboardScene()?.onStarDashboard(),
    canEditDashboard: (): boolean => getDashboardScene()?.canEditDashboard() ?? false,
    exitEditMode: (options: { skipConfirm: boolean; restoreInitialState?: boolean }) =>
      getDashboardScene()?.exitEditMode(options),
  };

  const addCallbackFunction = assistantFunctions.find((func) => func.title === 'addCallbackFunction');

  if (addCallbackFunction) {
    // register all dashboard actions as callback functions in the `dashboarding` namespace
    Object.keys(dashboardActions).forEach((actionName) => {
      const action = dashboardActions[actionName as keyof typeof dashboardActions];
      addCallbackFunction.fn('dashboarding', actionName, action);
    });
  }

  return null;
};
