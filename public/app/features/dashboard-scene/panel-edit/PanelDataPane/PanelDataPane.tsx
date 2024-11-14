import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { Container, ScrollContainer, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { PanelDataPaneTab, TabId } from './types';

export interface PanelDataPaneState extends SceneObjectState {
  tabs: PanelDataPaneTab[];
  tab: TabId;
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelDataPane extends SceneObjectBase<PanelDataPaneState> {
  static Component = PanelDataPaneRendered;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tab'] });

  public static createFor(panel: VizPanel) {
    const panelRef = panel.getRef();
    const tabs: PanelDataPaneTab[] = [
      new PanelDataQueriesTab({ panelRef }),
      new PanelDataTransformationsTab({ panelRef }),
    ];

    if (shouldShowAlertingTab(panel.state.pluginId)) {
      tabs.push(new PanelDataAlertingTab({ panelRef }));
    }

    return new PanelDataPane({
      panelRef,
      tabs,
      tab: TabId.Queries,
    });
  }

  public onChangeTab = (tab: PanelDataPaneTab) => {
    this.setState({ tab: tab.tabId });
  };

  public getUrlState() {
    return { tab: this.state.tab };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (!values.tab) {
      return;
    }
    if (typeof values.tab === 'string') {
      this.setState({ tab: values.tab as TabId });
    }
  }
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
        {tabs.map((t) => t.renderTab({ active: t.tabId === tab, onChangeTab: () => model.onChangeTab(t) }))}
      </TabsBar>
      <ScrollContainer backgroundColor="primary">
        <TabContent className={styles.tabContent}>
          <Container>{currentTab && <currentTab.Component model={currentTab} />}</Container>
        </TabContent>
      </ScrollContainer>
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
  };
}
