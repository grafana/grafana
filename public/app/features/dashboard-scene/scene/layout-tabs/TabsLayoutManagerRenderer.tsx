import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { TabItemMenu } from './TabItemMenu';
import { TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { tabs } = model.useState();
  const currentTab = model.getCurrentTab();
  const { layout } = currentTab.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();

  return (
    <>
      <TabsBar className={styles.tabsWrapper}>
        <div className={styles.tabsRow}>
          <div className={styles.tabsContainer}>
            {tabs.map((tab) => (
              <Fragment key={tab.state.key!}>
                <tab.Component model={tab} />
              </Fragment>
            ))}
          </div>
          {isEditing && <TabItemMenu model={currentTab} />}
        </div>
      </TabsBar>
      <TabContent className={styles.tabContentContainer}>
        {currentTab && <layout.Component model={layout} />}
      </TabContent>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabsWrapper: css({
    overflow: 'hidden',
  }),
  tabsRow: css({
    justifyContent: 'space-between',
    display: 'flex',
    width: '100%',
  }),
  tabsContainer: css({
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingInline: theme.spacing(0.125),
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
