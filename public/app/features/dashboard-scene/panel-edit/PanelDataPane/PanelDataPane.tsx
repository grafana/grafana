import { css } from '@emotion/css';
import { Unsubscribable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Container, CustomScrollbar, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { config, getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { VizPanelManager } from '../VizPanelManager';

import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { PanelDataPaneTab, TabId } from './types';

export interface PanelDataPaneState extends SceneObjectState {
  tabs?: PanelDataPaneTab[];
  tab?: TabId;
}

export class PanelDataPane extends SceneObjectBase<PanelDataPaneState> {
  static Component = PanelDataPaneRendered;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tab'] });
  private panelSubscription: Unsubscribable | undefined;
  public panelManager: VizPanelManager;

  getUrlState() {
    return {
      tab: this.state.tab,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (!values.tab) {
      return;
    }
    if (typeof values.tab === 'string') {
      this.setState({ tab: values.tab as TabId });
    }
  }

  constructor(panelMgr: VizPanelManager) {
    super({
      tab: TabId.Queries,
      tabs: [],
    });

    this.panelManager = panelMgr;
    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    this.buildTabs();

    this._subs.add(
      // Setup subscription for the case when panel type changed
      this.panelManager.subscribeToState((n, p) => {
        if (n.pluginId !== p.pluginId) {
          this.buildTabs();
        }
      })
    );

    return () => {
      if (this.panelSubscription) {
        this.panelSubscription.unsubscribe();
        this.panelSubscription = undefined;
      }
    };
  }

  private buildTabs() {
    const panelManager = this.panelManager;
    const panel = panelManager.state.panel;
    const pluginId = panelManager.state.pluginId;

    const runner = this.panelManager.queryRunner;
    const tabs: PanelDataPaneTab[] = [];

    if (panel) {
      if (config.panels[pluginId]?.skipDataQuery) {
        this.setState({ tabs });
        return;
      } else {
        if (runner) {
          tabs.push(new PanelDataQueriesTab(this.panelManager));
        }

        tabs.push(new PanelDataTransformationsTab(this.panelManager));

        if (shouldShowAlertingTab(panelManager.state.pluginId)) {
          tabs.push(new PanelDataAlertingTab(this.panelManager));
        }
      }
    }

    this.setState({ tabs });
  }

  onChangeTab = (tab: PanelDataPaneTab) => {
    this.setState({ tab: tab.tabId });
  };
}

function PanelDataPaneRendered({ model }: SceneComponentProps<PanelDataPane>) {
  const { tab, tabs } = model.useState();
  const styles = useStyles2(getStyles);

  if (!tabs || !tabs.length) {
    return;
  }

  const currentTab = tabs.find((t) => t.tabId === tab);

  return (
    <div className={styles.dataPane} data-testid={selectors.components.PanelEditor.DataPane.content}>
      <TabsBar hideBorder={true} className={styles.tabsBar}>
        {tabs.map((t, index) => {
          return (
            <t.TabComponent
              key={`${t.getTabLabel()}-${index}`}
              active={t.tabId === tab}
              onChangeTab={() => model.onChangeTab(t)}
            ></t.TabComponent>
          );
        })}
      </TabsBar>
      <CustomScrollbar className={styles.scroll}>
        <TabContent className={styles.tabContent}>
          <Container>{currentTab && <currentTab.Component model={currentTab} />}</Container>
        </TabContent>
      </CustomScrollbar>
    </div>
  );
}

export function shouldShowAlertingTab(pluginId: string) {
  const { unifiedAlertingEnabled = false } = getConfig();
  const hasRuleReadPermissions = contextSrv.hasPermission(getRulesPermissions(GRAFANA_RULES_SOURCE_NAME).read);
  const isAlertingAvailable = unifiedAlertingEnabled && hasRuleReadPermissions;
  if (!isAlertingAvailable) {
    return false;
  }

  const isGraph = pluginId === 'graph';
  const isTimeseries = pluginId === 'timeseries';

  return isGraph || isTimeseries;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    dataPane: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      height: '100%',
      width: '100%',
    }),
    tabContent: css({
      padding: theme.spacing(2),
      border: `1px solid ${theme.colors.border.weak}`,
      borderLeft: 'none',
      borderBottom: 'none',
      borderTopRightRadius: theme.shape.radius.default,
      flexGrow: 1,
    }),
    tabsBar: css({
      flexShrink: 0,
      paddingLeft: theme.spacing(2),
    }),
    scroll: css({
      background: theme.colors.background.primary,
    }),
  };
}
