import React from 'react';

import { SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { Alert, LoadingPlaceholder, Tab } from '@grafana/ui';
import { RulesTable } from 'app/features/alerting/unified/components/rules/RulesTable';
import { usePanelCombinedRules } from 'app/features/alerting/unified/hooks/usePanelCombinedRules';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';
import { VizPanelManager } from '../VizPanelManager';

import { PanelDataPaneTabState, PanelDataPaneTab, TabId, PanelDataTabHeaderProps } from './types';

export class PanelDataAlertingTab extends SceneObjectBase<PanelDataPaneTabState> implements PanelDataPaneTab {
  static Component = PanelDataAlertingTabRendered;
  TabComponent: (props: PanelDataTabHeaderProps) => React.JSX.Element;

  tabId = TabId.Alert;
  private _panelManager: VizPanelManager;

  constructor(panelManager: VizPanelManager) {
    super({});
    this.TabComponent = (props: PanelDataTabHeaderProps) => AlertingTab({ ...props, model: this });
    this._panelManager = panelManager;
  }
  getTabLabel() {
    return 'Alert';
  }

  getDashboardUID() {
    const dashboard = getDashboardSceneFor(this._panelManager);
    return dashboard.state.uid!;
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
      <button>New alert placeholder</button>
    </div>
  );
}

interface PanelDataAlertingTabHeaderProps extends PanelDataTabHeaderProps {
  model: PanelDataAlertingTab;
}

function AlertingTab(props: PanelDataAlertingTabHeaderProps) {
  const { model } = props;

  const { rules } = usePanelCombinedRules({
    dashboardUID: model.getDashboardUID(),
    panelId: model.getPanelId(),
    poll: false,
  });

  return (
    <Tab
      key={props.key}
      label={model.getTabLabel()}
      icon="bell"
      counter={rules.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
