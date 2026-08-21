import { Suspense, lazy } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { LoadingPlaceholder, Tab } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';

import { type PanelDataPaneTab, type PanelDataTabHeaderProps, TabId } from './types';

const PanelDataAlertingTabContent = lazy(() =>
  import(/* webpackChunkName: "PanelDataAlertingTab" */ './PanelDataAlertingTabContent').then((module) => ({
    default: module.PanelDataAlertingTabRendered,
  }))
);

const PanelDataAlertingTabHeader = lazy(() =>
  import(/* webpackChunkName: "PanelDataAlertingTab" */ './PanelDataAlertingTabContent').then((module) => ({
    default: module.AlertingTab,
  }))
);

export interface PanelDataAlertingTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelDataAlertingTab extends SceneObjectBase<PanelDataAlertingTabState> implements PanelDataPaneTab {
  static Component = LazyPanelDataAlertingTabContent;
  public tabId = TabId.Alert;

  public renderTab(props: PanelDataTabHeaderProps) {
    return (
      <Suspense
        key={this.getTabLabel()}
        fallback={
          <Tab
            label={this.getTabLabel()}
            icon="bell"
            active={props.active}
            onChangeTab={props.onChangeTab}
          />
        }
      >
        <PanelDataAlertingTabHeader model={this} {...props} />
      </Suspense>
    );
  }

  public getTabLabel() {
    return t('dashboard-scene.panel-data-alerting-tab.tab-label', 'Alert');
  }

  public getDashboardUID() {
    const dashboard = this.getDashboard();
    return dashboard.state.uid!;
  }

  public getDashboard() {
    return getDashboardSceneFor(this);
  }

  public getLegacyPanelId() {
    return getPanelIdForVizPanel(this.state.panelRef.resolve());
  }

  public getCanCreateRules() {
    return (
      config.unifiedAlerting &&
      this.getDashboard().state.meta.canSave &&
      contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate)
    );
  }
}

function LazyPanelDataAlertingTabContent({ model }: SceneComponentProps<PanelDataAlertingTab>) {
  return (
    <Suspense
      fallback={
        <LoadingPlaceholder
          text={t('dashboard-scene.panel-data-alerting-tab-rendered.text-loading-rules', 'Loading rules...')}
        />
      }
    >
      <PanelDataAlertingTabContent model={model} />
    </Suspense>
  );
}
