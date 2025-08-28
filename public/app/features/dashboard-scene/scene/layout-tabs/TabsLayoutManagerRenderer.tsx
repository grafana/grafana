import { css } from '@emotion/css';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { MultiValueVariable, SceneComponentProps, sceneGraph, useSceneObjectState } from '@grafana/scenes';
import { Button, TabsBar, useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { getDashboardSceneFor } from '../../utils/utils';
import { useSoloPanelContext } from '../SoloPanelContext';
import { dashboardCanvasAddButtonHoverStyles } from '../layouts-shared/styles';
import { useClipboardState } from '../layouts-shared/useClipboardState';

import { TabItem } from './TabItem';
import { TabItemLayoutRenderer } from './TabItemRenderer';
import { TabItemRepeater } from './TabItemRepeater';
import { TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { tabs, key } = model.useState();
  const currentTab = model.getCurrentTab();
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();
  const { hasCopiedTab } = useClipboardState();
  const soloPanelContext = useSoloPanelContext();

  useEffect(() => {
    if (currentTab && currentTab.getSlug() !== model.state.currentTabSlug) {
      model.setState({ currentTabSlug: currentTab.getSlug() });
    }
  }, [currentTab, model]);

  if (soloPanelContext) {
    return tabs.map((tab) => <TabWrapper tab={tab} manager={model} key={tab.state.key!} />);
  }

  const isClone = isRepeatCloneOrChildOf(model);

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

            model.moveTab(result.source.index, result.destination.index);
          }}
        >
          <div className={styles.tabsRow}>
            <Droppable droppableId={key!} direction="horizontal">
              {(dropProvided) => (
                <div className={styles.tabsContainer} ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                  {tabs.map((tab) => (
                    <TabWrapper tab={tab} manager={model} key={tab.state.key!} />
                  ))}

                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
            {isEditing && !isClone && (
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

      {currentTab && <TabItemLayoutRenderer tab={currentTab} isEditing={isEditing} />}
    </div>
  );
}

function TabWrapper({ tab, manager }: { tab: TabItem; manager: TabsLayoutManager }) {
  const { repeatByVariable } = useSceneObjectState(tab, { shouldActivateOrKeepAlive: true });

  if (repeatByVariable) {
    const variable = sceneGraph.lookupVariable(repeatByVariable, manager);

    if (variable instanceof MultiValueVariable) {
      return <TabItemRepeater tab={tab} key={tab.state.key!} manager={manager} variable={variable} />;
    }
  }
  return <tab.Component model={tab} key={tab.state.key!} />;
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
});
