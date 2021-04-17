import React, { FC, useEffect } from 'react';
import { css } from '@emotion/css';
import { IconName, Tab, TabContent, TabsBar, useForceUpdate, useStyles } from '@grafana/ui';
import { AlertTab } from 'app/features/alerting/AlertTab';
import { TransformationsEditor } from '../TransformationsEditor/TransformationsEditor';
import { DashboardModel, PanelModel } from '../../state';
import { PanelEditorTab, PanelEditorTabId } from './types';
import { Subscription } from 'rxjs';
import { PanelQueriesChangedEvent, PanelTransformationsChangedEvent } from 'app/types/events';
import { PanelEditorQueries } from './PanelEditorQueries';
import { GrafanaTheme } from '@grafana/data';

interface PanelEditorTabsProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  tabs: PanelEditorTab[];
  onChangeTab: (tab: PanelEditorTab) => void;
}

export const PanelEditorTabs: FC<PanelEditorTabsProps> = React.memo(({ panel, dashboard, tabs, onChangeTab }) => {
  const forceUpdate = useForceUpdate();
  const styles = useStyles(getStyles);

  useEffect(() => {
    const eventSubs = new Subscription();
    eventSubs.add(panel.events.subscribe(PanelQueriesChangedEvent, forceUpdate));
    eventSubs.add(panel.events.subscribe(PanelTransformationsChangedEvent, forceUpdate));
    return () => eventSubs.unsubscribe();
  }, [panel, forceUpdate]);

  const activeTab = tabs.find((item) => item.active)!;

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <TabsBar className={styles.tabBar} hideBorder>
        {tabs.map((tab) => {
          return (
            <Tab
              key={tab.id}
              label={tab.text}
              active={tab.active}
              onChangeTab={() => onChangeTab(tab)}
              icon={tab.icon as IconName}
              counter={getCounter(panel, tab)}
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab.id === PanelEditorTabId.Query && <PanelEditorQueries panel={panel} queries={panel.targets} />}
        {activeTab.id === PanelEditorTabId.Alert && <AlertTab panel={panel} dashboard={dashboard} />}
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

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
    tabBar: css`
      padding-left: ${theme.spacing.md};
    `,
    tabContent: css`
      padding: 0;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-height: 0;
      background: ${theme.v2.palette.background.primary};
      border-right: 1px solid ${theme.v2.components.panel.border};
    `,
  };
};
