import { css } from '@emotion/css';
import { memo, useCallback, useEffect } from 'react';
import { Subscription } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Tab, TabContent, TabsBar, toIconName, useForceUpdate, useStyles2 } from '@grafana/ui';
import { PanelAlertTab } from 'app/features/alerting/unified/PanelAlertTab';
import { PanelAlertTabContent } from 'app/features/alerting/unified/PanelAlertTabContent';
import { PanelQueriesChangedEvent, PanelTransformationsChangedEvent } from 'app/types/events';

import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';
import { TransformationsEditor } from '../TransformationsEditor/TransformationsEditor';

import { PanelEditorQueries } from './PanelEditorQueries';
import { PanelEditorTab, PanelEditorTabId } from './types';

interface PanelEditorTabsProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  tabs: PanelEditorTab[];
  onChangeTab: (tab: PanelEditorTab) => void;
}

export const PanelEditorTabs = memo(({ panel, dashboard, tabs, onChangeTab }: PanelEditorTabsProps) => {
  const forceUpdate = useForceUpdate();
  const styles = useStyles2(getStyles);

  const instrumentedOnChangeTab = useCallback(
    (tab: PanelEditorTab) => {
      let eventName = 'panel_editor_tabs_changed';
      if (config.featureToggles.transformationsRedesign) {
        eventName = 'transformations_redesign_' + eventName;
      }

      if (!tab.active) {
        reportInteraction(eventName, { tab_id: tab.id });
      }

      onChangeTab(tab);
    },
    [onChangeTab]
  );

  useEffect(() => {
    const eventSubs = new Subscription();
    eventSubs.add(panel.events.subscribe(PanelQueriesChangedEvent, forceUpdate));
    eventSubs.add(panel.events.subscribe(PanelTransformationsChangedEvent, forceUpdate));
    return () => eventSubs.unsubscribe();
  }, [panel, dashboard, forceUpdate]);

  const activeTab = tabs.find((item) => item.active)!;

  if (tabs.length === 0) {
    return null;
  }

  const alertingEnabled = config.unifiedAlertingEnabled;

  return (
    <div className={styles.wrapper}>
      <TabsBar className={styles.tabBar} hideBorder>
        {tabs.map((tab) => {
          if (tab.id === PanelEditorTabId.Alert && alertingEnabled) {
            return (
              <PanelAlertTab
                key={tab.id}
                label={tab.text}
                active={tab.active}
                onChangeTab={() => onChangeTab(tab)}
                icon={toIconName(tab.icon)}
                panel={panel}
                dashboard={dashboard}
              />
            );
          }
          return (
            <Tab
              key={tab.id}
              label={tab.text}
              active={tab.active}
              onChangeTab={() => instrumentedOnChangeTab(tab)}
              icon={toIconName(tab.icon)}
              counter={getCounter(panel, tab)}
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab.id === PanelEditorTabId.Query && <PanelEditorQueries panel={panel} queries={panel.targets} />}
        {activeTab.id === PanelEditorTabId.Alert && <PanelAlertTabContent panel={panel} dashboard={dashboard} />}
        {activeTab.id === PanelEditorTabId.Transform && <TransformationsEditor panel={panel} />}
      </TabContent>
    </div>
  );
});

PanelEditorTabs.displayName = 'PanelEditorTabs';

function getCounter(panel: PanelModel, tab: PanelEditorTab) {
  switch (tab.id) {
    case PanelEditorTabId.Query:
      return panel.targets.length;
    case PanelEditorTabId.Alert:
      return panel.alert ? 1 : 0;
    case PanelEditorTabId.Transform:
      const transformations = panel.getTransformations() ?? [];
      return transformations.length;
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }),
    tabBar: css({
      paddingLeft: theme.spacing(2),
    }),
    tabContent: css({
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.components.panel.borderColor}`,
      borderLeft: 'none',
      borderBottom: 'none',
      borderTopRightRadius: theme.shape.borderRadius(1.5),
    }),
  };
};
