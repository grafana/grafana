import appEvents from 'app/core/app_events';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import store from 'app/core/store';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';

export const removePanel = (dashboard: DashboardModel, panel: PanelModel, ask: boolean) => {
  // confirm deletion
  if (ask !== false) {
    const text2 = panel.alert ? 'Panel includes an alert rule, removing panel will also remove alert rule' : null;
    const confirmText = panel.alert ? 'YES' : null;

    appEvents.emit('confirm-modal', {
      title: 'Remove Panel',
      text: 'Are you sure you want to remove this panel?',
      text2: text2,
      icon: 'fa-trash',
      confirmText: confirmText,
      yesText: 'Remove',
      onConfirm: () => removePanel(dashboard, panel, false),
    });
    return;
  }
  dashboard.removePanel(panel);
};

export const duplicatePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  dashboard.duplicatePanel(panel);
};

export const copyPanel = (panel: PanelModel) => {
  store.set(LS_PANEL_COPY_KEY, JSON.stringify(panel.getSaveModel()));
  appEvents.emit('alert-success', ['Panel copied. Open Add Panel to paste']);
};

const replacePanel = (dashboard: DashboardModel, newPanel: PanelModel, oldPanel: PanelModel) => {
  const index = dashboard.panels.findIndex(panel => {
    return panel.id === oldPanel.id;
  });

  const deletedPanel = dashboard.panels.splice(index, 1);
  dashboard.events.emit('panel-removed', deletedPanel);

  newPanel = new PanelModel(newPanel);
  newPanel.id = oldPanel.id;

  dashboard.panels.splice(index, 0, newPanel);
  dashboard.sortPanelsByGridPos();
  dashboard.events.emit('panel-added', newPanel);
};

export const editPanelJson = (dashboard: DashboardModel, panel: PanelModel) => {
  const model = {
    object: panel.getSaveModel(),
    updateHandler: (newPanel: PanelModel, oldPanel: PanelModel) => {
      replacePanel(dashboard, newPanel, oldPanel);
    },
    enableCopy: true,
  };

  appEvents.emit('show-modal', {
    src: 'public/app/partials/edit_json.html',
    model: model,
  });
};

export const sharePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  appEvents.emit('show-modal', {
    src: 'public/app/features/dashboard/partials/shareModal.html',
    model: {
      dashboard: dashboard,
      panel: panel,
    },
  });
};

export const refreshPanel = (panel: PanelModel) => {
  panel.refresh();
};

export const toggleLegend = (panel: PanelModel) => {
  console.log('Toggle legend is not implemented yet');
  // We need to set panel.legend defaults first
  // panel.legend.show = !panel.legend.show;
  refreshPanel(panel);
};
