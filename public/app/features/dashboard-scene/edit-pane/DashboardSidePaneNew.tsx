import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Button, Icon, Sidebar, Stack, Text, useStyles2 } from '@grafana/ui';
import { getLayoutType } from 'app/features/dashboard/utils/tracking';
import addPanelImg from 'img/dashboards/add-panel.png';

import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

interface Props {
  dashboard: SceneObject;
  selectedElement: SceneObject | undefined;
  onAddPanel: () => void;
}

export function DashboardSidePaneNew({ onAddPanel, dashboard, selectedElement }: Props) {
  const styles = useStyles2(getStyles);
  const dashboardScene = getDashboardSceneFor(dashboard);
  const orchestrator = dashboardScene.state.layoutOrchestrator;

  const onAddPanelClick = () => {
    onAddPanel();
    DashboardInteractions.trackAddPanelClick('sidebar', getLayoutType(selectedElement));
  };

  const onAddTabsClick = () => {};
  const onAddRowsClick = () => {};

  return (
    <div>
      <Sidebar.PaneHeader title={t('dashboard.add.pane-header', 'Add')} />

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Text weight="medium">{t('dashboard.add.new-panel.title', 'Panel')}</Text>
          <Text element="p" variant="bodySmall" color="secondary">
            {t('dashboard.add.new-panel.description', 'Drag or click to add a panel')}
          </Text>
        </div>
        <DragDropContext onDragStart={() => orchestrator?.startDraggingNewPanel()} onDragEnd={() => {}}>
          <Droppable droppableId="side-drop-id" isDropDisabled>
            {(dropProvided) => (
              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                <div className={styles.dragContainer}>
                  <Draggable draggableId="new-panel-drag" index={0}>
                    {(dragProvided, dragSnapshot) => {
                      return (
                        <div
                          role="button"
                          data-testid={selectors.components.Sidebar.newPanelButton}
                          tabIndex={0}
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={cx(styles.imageContainer, dragSnapshot.isDragging && styles.dragging)}
                          onClick={onAddPanelClick}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onAddPanelClick();
                            }
                          }}
                          aria-label={t('dashboard.add.new-panel.title', 'Panel')}
                        >
                          <img
                            alt={t('dashboard.add.new-panel.button', 'Add new panel button')}
                            src={addPanelImg}
                            draggable={false}
                          />
                        </div>
                      );
                    }}
                  </Draggable>
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Text weight="medium">
            <Trans i18nKey="dashboard-scene.dashboard-side-pane-new.panel-groups">Panel groups</Trans>
          </Text>
          <Text element="p" variant="bodySmall" color="secondary">
            <Trans i18nKey="dashboard-scene.dashboard-side-pane-new.existing-panels-first-group">
              Existing panels go to the first group
            </Trans>
          </Text>
        </div>

        <Stack direction="column" gap={2}>
          <AddItemButton
            icon="layers"
            label={t('dashboard-scene.dashboard-side-pane-new.label-tabs', 'Tabs')}
            description={t('dashboard-scene.dashboard-side-pane-new.description-multiple-views', 'Multiple views')}
            tooltip={t(
              'dashboard-scene.dashboard-side-pane-new.tooltip-group-panels-into-tabs',
              'Group panels into tabs'
            )}
            onClick={onAddTabsClick}
          />
          <AddItemButton
            icon="brackets-curly"
            label={t('dashboard-scene.dashboard-side-pane-new.label-rows', 'Rows')}
            description={t(
              'dashboard-scene.dashboard-side-pane-new.description-expandable-sections',
              'Expandable sections'
            )}
            tooltip={t(
              'dashboard-scene.dashboard-side-pane-new.tooltip-group-panels-into-rows',
              'Group panels into rows'
            )}
            onClick={onAddRowsClick}
          />
        </Stack>
      </div>
    </div>
  );
}

type AddItemButtonProps = {
  icon: IconName;
  label: string;
  description: string;
  tooltip: string;
  onClick: () => void;
};

function AddItemButton({ icon, label, description, tooltip, onClick }: AddItemButtonProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.control}>
      <Button variant="secondary" fill="outline" onClick={onClick} tooltip={tooltip} className={styles.iconButton}>
        <Icon name={icon} size="xl" />
      </Button>
      <div className={styles.labelContainer}>
        <Text weight="medium">{label}</Text>
        <Text element="p" variant="bodySmall" color="secondary">
          {description}
        </Text>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
    }),
    sectionHeader: css({
      margin: theme.spacing(0, 0, 3, 0),
    }),
    dragging: css({
      cursor: 'move',
    }),
    dragContainer: css({
      height: 150,
    }),
    imageContainer: css({
      cursor: 'pointer',
      opacity: 0.8,
      overflow: 'hidden',
      padding: theme.spacing(2, 0),
      borderRadius: theme.shape.radius.sm,
      width: '100%',
      '&:hover': {
        opacity: 1,
      },
    }),
    control: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      alignItems: 'stretch',
      width: '100%',
    }),
    iconButton: css({
      height: '46px',
      lineHeight: '46px',
      padding: theme.spacing(0, 1),
      '& svg': {
        opacity: 0.6,
      },
      '&:hover svg': {
        opacity: 1,
      },
    }),
    labelContainer: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-evenly',
    }),
  };
}
