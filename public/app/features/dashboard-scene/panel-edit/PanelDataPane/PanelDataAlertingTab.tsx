import React from 'react';

import { IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps, SceneQueryRunner } from '@grafana/scenes';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { RulesTable } from 'app/features/alerting/unified/components/rules/RulesTable';
import { usePanelCombinedRules } from 'app/features/alerting/unified/hooks/usePanelCombinedRules';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';
import { VizPanelManager } from '../VizPanelManager';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';
import { useAsync } from 'react-use';
import { ScenesNewRuleFromPanelButton } from 'app/features/alerting/unified/components/panel-alerts-tab/NewRuleFromPanelButton';

export class PanelDataAlertingTab extends SceneObjectBase<PanelDataPaneTabState> implements PanelDataPaneTab {
  static Component = PanelDataAlertingTabRendered;
  tabId = 'alert';
  icon: IconName = 'bell';
  private _panelManager: VizPanelManager;

  constructor(panelManager: VizPanelManager) {
    super({});

    this._panelManager = panelManager;
  }
  getTabLabel() {
    return 'Alert';
  }

  getItemsCount() {
    return 0;
  }

  getDashboardUID() {
    const dashboard = getDashboardSceneFor(this._panelManager);
    return dashboard.state.uid!;
  }

  getDashboard() {
    return getDashboardSceneFor(this._panelManager);
  }

  getPanel() {
    return this._panelManager.state.panel;
  }

  public getQueryRunner(): SceneQueryRunner {
    return this._panelManager.queryRunner;
  }

  getPanelId() {
    return getPanelIdForVizPanel(this._panelManager.state.panel);
  }

  get panelManager() {
    return this._panelManager;
  }
}

function PanelDataAlertingTabRendered(props: SceneComponentProps<PanelDataAlertingTab>) {
  const { model } = props;

  const { errors, loading, rules } = usePanelCombinedRules({
    dashboardUID: model.getDashboardUID(),
    panelId: model.getPanelId(),
    poll: true,
  });

  const { loading: loadingButton, value: formValues } = useAsync(
    () => scenesPanelToRuleFormValues(model.getPanel(), model.getQueryRunner(), model.getDashboard()),
    // Templating variables are required to update formValues on each variable's change. It's used implicitly by the templating engine
    [model]
  );

  const alert = errors.length ? (
    <Alert title="Errors loading rules" severity="error">
      {errors.map((error, index) => (
        <div key={index}>Failed to load Grafana rules state: {error.message || 'Unknown error.'}</div>
      ))}
    </Alert>
  ) : null;

  if (loading && !rules.length) {
    return (
      <>
        {alert}
        <LoadingPlaceholder text="Loading rules..." />
      </>
    );
  }

  if (rules.length) {
    return <RulesTable rules={rules} />;
  }

  // TODO: this is the tricky part, converting queries and such to pre populate the new alert form when clicking the button
  return (
    <div>
      <p>There are no alert rules linked to this panel.</p>
      <ScenesNewRuleFromPanelButton
        dashboard={model.getDashboard()}
        panel={model.getPanel()}
        queryRunner={model.getQueryRunner()}
      ></ScenesNewRuleFromPanelButton>
      <button>{String(formValues)}</button>
    </div>
  );
}
