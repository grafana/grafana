import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { tabs, currentTabIndex } = model.useState();
  const currentTab = tabs[currentTabIndex];
  const { layout } = currentTab.useState();

  return (
    <>
      <TabsBar className={styles.tabsContainer}>
        {tabs.map((tab) => (
          <tab.Component model={tab} key={tab.state.key!} />
        ))}
      </TabsBar>
      <TabContent className={styles.tabContentContainer}>
        {currentTab && <layout.Component model={layout} />}
      </TabContent>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabsContainer: css({
    flexShrink: 1,
    padding: '2px 2px 0 2px',
    marginBottom: theme.spacing(1),
  }),
  tabContentContainer: css({
    backgroundColor: 'transparent',
    display: 'flex',
    flex: 1,
    height: '100%',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    padding: '2px 2px 0 2px',
  }),
});
