import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { useCallback } from 'react';

import { AnnotationQuery, getDataSourceRef, GrafanaTheme2, IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneObject } from '@grafana/scenes';
import { Button, Icon, Sidebar, Text, useStyles2 } from '@grafana/ui';
import { getLayoutType } from 'app/features/dashboard/utils/tracking';
import addPanelImg from 'img/dashboards/add-panel.png';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardScene } from '../scene/DashboardScene';
import { newAnnotationName } from '../settings/annotations/AnnotationSettingsEdit';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
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
            <Trans i18nKey="dashboard-scene.dashboard-side-pane-new.dashboard-controls">Dashboard controls</Trans>
          </Text>
        </div>
        <AnnotationControl dashboardScene={dashboardScene} />
      </div>
    </div>
  );
}

function AnnotationControl({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddAnnotation = useCallback(() => {
    const defaultDatasource = getDataSourceSrv().getInstanceSettings(null);
    const datasourceRef = defaultDatasource?.meta.annotations ? getDataSourceRef(defaultDatasource) : undefined;

    const newAnnotationQuery: AnnotationQuery = {
      name: newAnnotationName,
      enable: true,
      datasource: datasourceRef,
      iconColor: 'red',
    };

    const newAnnotation = new DashboardAnnotationsDataLayer({
      query: newAnnotationQuery,
      name: newAnnotationQuery.name,
      isEnabled: Boolean(newAnnotationQuery.enable),
      isHidden: Boolean(newAnnotationQuery.hide),
    });

    const dataLayers = dashboardSceneGraph.getDataLayers(dashboardScene);
    dataLayers.addAnnotationLayer(newAnnotation);

    // Select the newly added annotation
    const { editPane } = dashboardScene.state;
    editPane.selectObject(newAnnotation, newAnnotation.state.key!);
  }, [dashboardScene]);

  return (
    <DashboardControl
      icon="comment-alt"
      label={t('dashboard-scene.annotation-control.label-annotation-query', 'Annotation query')}
      description={t(
        'dashboard-scene.annotation-control.description-add-event-data-to-graphs',
        'Add event data to graphs'
      )}
      tooltip={t('dashboard-scene.annotation-control.tooltip-add-new-annotation-query', 'Add new annotation query')}
      onClick={onAddAnnotation}
    />
  );
}

type DashboardControlProps = {
  icon: IconName;
  label: string;
  description: string;
  tooltip: string;
  onClick: () => void;
};

function DashboardControl({ icon, label, description, tooltip, onClick }: DashboardControlProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.control}>
      <div>
        <Button
          variant="secondary"
          fill="outline"
          size="lg"
          onClick={onClick}
          className={styles.iconButton}
          tooltip={tooltip}
        >
          <Icon name={icon} size="xl" />
        </Button>
      </div>
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
      margin: theme.spacing(0, 0, 1, 0),
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
      padding: theme.spacing(0, 1.5),
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
