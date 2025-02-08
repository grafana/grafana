import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Divider, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { tabs, currentTab } = model.useState();
  const { layout } = currentTab.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();

  return (
    <>
      <TabsBar className={styles.tabsContainer}>
        {tabs.map((tab, idx) => (
          <Fragment key={tab.state.key!}>
            {isEditing && idx > 0 && <Divider direction="vertical" />}
            <tab.Component model={tab} />
          </Fragment>
        ))}
      </TabsBar>
      <TabContent className={styles.tabContentContainer}>{layout && <layout.Component model={layout} />}</TabContent>
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
