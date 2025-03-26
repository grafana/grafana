import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { getDashboardSceneFor } from '../../utils/utils';

import { TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { tabs } = model.useState();
  const currentTab = model.getCurrentTab();
  const { layout } = currentTab.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();

  return (
    <div className={styles.tabLayoutContainer}>
      <TabsBar className={styles.tabsBar}>
        <div className={styles.tabsRow}>
          <div className={styles.tabsContainer}>
            {tabs.map((tab) => (
              <Fragment key={tab.state.key!}>
                <tab.Component model={tab} />
              </Fragment>
            ))}
          </div>
          {isEditing && (
            <div className="dashboard-canvas-add-button">
              <Button icon="plus" variant="primary" fill="text" onClick={() => model.addNewTab()}>
                <Trans i18nKey="dashboard.canvas-actions.new-tab">New tab</Trans>
              </Button>
            </div>
          )}
        </div>
      </TabsBar>
      <TabContent className={styles.tabContentContainer}>
        {currentTab && <layout.Component model={layout} />}
      </TabContent>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabLayoutContainer: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
  }),
  tabsBar: css({
    overflow: 'hidden',
    '&:hover': {
      '.dashboard-canvas-add-button': {
        filter: 'unset',
        opacity: 1,
      },
    },
  }),
  tabsRow: css({
    display: 'flex',
    width: '100%',
    alignItems: 'center',
  }),
  tabsContainer: css({
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingInline: theme.spacing(0.125),
    paddingTop: '1px',
  }),
  tabContentContainer: css({
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    paddingTop: theme.spacing(1),
  }),
});
