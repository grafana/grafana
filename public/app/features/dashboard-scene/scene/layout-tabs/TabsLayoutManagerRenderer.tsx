import { css } from '@emotion/css';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { getDashboardSceneFor } from '../../utils/utils';
import { useClipboardState } from '../layouts-shared/useClipboardState';

import { TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { tabs, key } = model.useState();
  const currentTab = model.getCurrentTab();
  const { layout } = currentTab.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();
  const { hasCopiedTab } = useClipboardState();

  return (
    <div className={styles.tabLayoutContainer}>
      <TabsBar className={styles.tabsBar}>
        <DragDropContext
          onBeforeDragStart={(start) => model.forceSelectTab(start.draggableId)}
          onDragEnd={(result) => {
            if (!result.destination) {
              return;
            }

            if (result.destination.index === result.source.index) {
              return;
            }

            model.moveTab(result.draggableId, result.source.index, result.destination.index);
          }}
        >
          <div className={styles.tabsRow}>
            <Droppable droppableId={key!} direction="horizontal">
              {(dropProvided) => (
                <div className={styles.tabsContainer} ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                  {tabs.map((tab) => (
                    <tab.Component model={tab} key={tab.state.key!} />
                  ))}

                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
            {isEditing && (
              <div className="dashboard-canvas-add-button">
                <Button icon="plus" variant="primary" fill="text" onClick={() => model.addNewTab()}>
                  <Trans i18nKey="dashboard.canvas-actions.new-tab">New tab</Trans>
                </Button>
                {hasCopiedTab && (
                  <Button icon="plus" variant="primary" fill="text" onClick={() => model.pasteTab()}>
                    <Trans i18nKey="dashboard.canvas-actions.paste-tab">Paste tab</Trans>
                  </Button>
                )}
              </div>
            )}
          </div>
        </DragDropContext>
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
