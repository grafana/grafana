import { css, cx } from '@emotion/css';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { useIsConditionallyHidden } from '../../conditional-rendering/useIsConditionallyHidden';
import { getDashboardSceneFor } from '../../utils/utils';
import { dashboardCanvasAddButtonHoverStyles } from '../layouts-shared/styles';
import { useClipboardState } from '../layouts-shared/useClipboardState';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { tabs, key } = model.useState();
  const currentTab = model.getCurrentTab();
  const { layout } = currentTab.useState();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();
  const { hasCopiedTab } = useClipboardState();
  const [_, conditionalRenderingClass, conditionalRenderingOverlay] = useIsConditionallyHidden(currentTab);
  const isNestedInTab = useMemo(() => model.parent instanceof TabItem, [model.parent]);

  return (
    <div className={cx(styles.tabLayoutContainer, { [styles.nestedTabsMargin]: isNestedInTab })}>
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

            model.moveTab(result.source.index, result.destination.index);
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
                <Button
                  icon="plus"
                  variant="primary"
                  fill="text"
                  onClick={() => model.addNewTab()}
                  data-testid={selectors.components.CanvasGridAddActions.addTab}
                >
                  <Trans i18nKey="dashboard.canvas-actions.new-tab">New tab</Trans>
                </Button>
                {hasCopiedTab && (
                  <Button
                    icon="clipboard-alt"
                    variant="primary"
                    fill="text"
                    onClick={() => model.pasteTab()}
                    data-testid={selectors.components.CanvasGridAddActions.pasteTab}
                  >
                    <Trans i18nKey="dashboard.canvas-actions.paste-tab">Paste tab</Trans>
                  </Button>
                )}
              </div>
            )}
          </div>
        </DragDropContext>
      </TabsBar>

      {isEditing && (
        <TabContent className={cx(styles.tabContentContainer, conditionalRenderingClass)}>
          {currentTab && <layout.Component model={layout} />}
          {conditionalRenderingOverlay}
        </TabContent>
      )}

      {!isEditing && (
        <TabContent className={styles.tabContentContainer}>
          {currentTab && <layout.Component model={layout} />}
        </TabContent>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabLayoutContainer: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
  }),
  tabsBar: css(dashboardCanvasAddButtonHoverStyles),
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
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    // Without this min height, the custom grid (SceneGridLayout) wont render
    // Should be bigger than paddingTop value
    // consist of paddingTop + 0.125 = 9px
    minHeight: theme.spacing(1 + 0.125),
    paddingTop: theme.spacing(1),
  }),
  nestedTabsMargin: css({
    marginLeft: theme.spacing(2),
  }),
});
