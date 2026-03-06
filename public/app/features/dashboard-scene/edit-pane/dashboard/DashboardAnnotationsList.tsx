import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { SceneDataLayerProvider } from '@grafana/scenes';
import { Box, Button, Icon, Stack, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { getDashboardSceneFor } from '../../utils/utils';
import { useBuildAddAnnotation } from '../add-new/AddAnnotationQuery';
import { dashboardEditActions } from '../shared';

import { partitionSceneObjects } from './helpers';
import { getDraggableListStyles } from './styles';

const ID_VISIBLE_LIST = 'annotations-list-visible';
const ID_CONTROLS_MENU_LIST = 'annotations-list-controls-menu';
const ID_HIDDEN_LIST = 'annotations-list-hidden';

const DROPPABLE_TO_PLACEMENT: Record<string, { isHidden: boolean; placement?: 'inControlsMenu' }> = {
  [ID_VISIBLE_LIST]: { isHidden: false, placement: undefined },
  [ID_CONTROLS_MENU_LIST]: { isHidden: false, placement: 'inControlsMenu' },
  [ID_HIDDEN_LIST]: { isHidden: true, placement: undefined },
};

export function DashboardAnnotationsList({ dataLayerSet }: { dataLayerSet: DashboardDataLayerSet }) {
  const styles = useStyles2(getDraggableListStyles);
  const { annotationLayers } = dataLayerSet.useState();
  const { visible, controlsMenu, hidden } = useMemo(
    () => partitionAnnotationsByDisplay(annotationLayers),
    [annotationLayers]
  );

  const onClickAnnotation = useCallback((a: DashboardAnnotationsDataLayer) => {
    const { editPane } = getDashboardSceneFor(a).state;
    editPane.selectObject(a, a.state.key!);
  }, []);

  const onClickAddAnnotation = useBuildAddAnnotation(dataLayerSet);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result;
      if (!destination) {
        return;
      }

      const isSameList = source.droppableId === destination.droppableId;
      if (isSameList && source.index === destination.index) {
        return;
      }

      const currentLayers = dataLayerSet.state.annotationLayers;
      const lists: Record<string, SceneDataLayerProvider[]> = {
        [ID_VISIBLE_LIST]: [...visible],
        [ID_CONTROLS_MENU_LIST]: [...controlsMenu],
        [ID_HIDDEN_LIST]: [...hidden],
      };

      const sourceList = lists[source.droppableId];
      const destList = isSameList ? sourceList : lists[destination.droppableId];

      const [moved] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, moved);

      const oldState = { isHidden: moved.state.isHidden, placement: moved.state.placement };
      const newState = DROPPABLE_TO_PLACEMENT[destination.droppableId];

      dashboardEditActions.edit({
        source: dataLayerSet,
        description: t('dashboard-scene.annotations-list.drag-end.description', 'Reorder annotations list'),
        perform: () => {
          moved.setState(newState);
          dataLayerSet.setState({
            annotationLayers: [...lists[ID_VISIBLE_LIST], ...lists[ID_CONTROLS_MENU_LIST], ...lists[ID_HIDDEN_LIST]],
          });
        },
        undo: () => {
          moved.setState(oldState);
          dataLayerSet.setState({ annotationLayers: currentLayers });
        },
      });
    },
    [dataLayerSet, visible, controlsMenu, hidden]
  );

  return (
    <Stack direction="column" gap={1}>
      <DragDropContext onDragEnd={onDragEnd}>
        <OptionsPaneCategory
          id={ID_VISIBLE_LIST}
          className={styles.sectionContainer}
          title={t(
            'dashboard-scene.dashboard-annotations-list.title-above-dashboard-count',
            'Above dashboard ({{count}})',
            {
              count: visible.length,
            }
          )}
        >
          <AnnotationsSection
            annotations={visible}
            droppableId={ID_VISIBLE_LIST}
            onClickAnnotation={onClickAnnotation}
          />
        </OptionsPaneCategory>
        <OptionsPaneCategory
          id={ID_CONTROLS_MENU_LIST}
          className={styles.sectionContainer}
          title={t(
            'dashboard-scene.dashboard-annotations-list.title-controls-menu-count',
            'Controls menu ({{count}})',
            {
              count: controlsMenu.length,
            }
          )}
        >
          <AnnotationsSection
            annotations={controlsMenu}
            droppableId={ID_CONTROLS_MENU_LIST}
            onClickAnnotation={onClickAnnotation}
          />
        </OptionsPaneCategory>
        <OptionsPaneCategory
          id={ID_HIDDEN_LIST}
          className={styles.sectionContainer}
          title={t('dashboard-scene.dashboard-annotations-list.title-hidden-count', 'Hidden ({{count}})', {
            count: hidden.length,
          })}
        >
          <AnnotationsSection annotations={hidden} droppableId={ID_HIDDEN_LIST} onClickAnnotation={onClickAnnotation} />
        </OptionsPaneCategory>
      </DragDropContext>
      <Box display="flex" paddingTop={0} paddingBottom={2}>
        <Button
          fullWidth
          icon="plus"
          size="sm"
          variant="secondary"
          onClick={onClickAddAnnotation}
          data-testid={selectors.components.PanelEditor.ElementEditPane.addAnnotationButton}
        >
          <Trans i18nKey="dashboard-scene.dashboard-annotations-list.add-annotation-query">Add annotation query</Trans>
        </Button>
      </Box>
    </Stack>
  );
}

function AnnotationsSection({
  annotations,
  droppableId,
  onClickAnnotation,
}: {
  annotations: DashboardAnnotationsDataLayer[];
  droppableId: string;
  onClickAnnotation: (a: DashboardAnnotationsDataLayer) => void;
}) {
  const styles = useStyles2(getStyles);

  return (
    <Droppable droppableId={droppableId} direction="vertical">
      {(provided) => (
        <ul ref={provided.innerRef} {...provided.droppableProps} className={styles.list} data-testid={droppableId}>
          {annotations.map((annotation, index) => (
            <Draggable
              key={annotation.state.key ?? annotation.state.name}
              draggableId={annotation.state.key ?? annotation.state.name}
              index={index}
            >
              {(draggableProvided) => (
                <li ref={draggableProvided.innerRef} {...draggableProvided.draggableProps} className={styles.listItem}>
                  <div {...draggableProvided.dragHandleProps}>
                    <Tooltip
                      content={t('dashboard-scene.annotations-section.content-drag-to-reorder', 'Drag to reorder')}
                      placement="top"
                    >
                      <Icon name="draggabledots" size="md" className={styles.dragHandle} />
                    </Tooltip>
                  </div>
                  <div
                    className={styles.itemName}
                    role="button"
                    tabIndex={0}
                    onClick={() => onClickAnnotation(annotation)}
                    onKeyDown={(event: React.KeyboardEvent) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onClickAnnotation(annotation);
                      }
                    }}
                  >
                    <div data-testid={`${droppableId}-annotation-name`}>
                      <AnnotationName annotation={annotation} />
                    </div>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Button variant="primary" size="sm" fill="outline">
                        <Trans i18nKey="dashboard-scene.annotations-section.select">Select</Trans>
                      </Button>
                    </Stack>
                  </div>
                </li>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </ul>
      )}
    </Droppable>
  );
}

function AnnotationName({ annotation }: { annotation: DashboardAnnotationsDataLayer }) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { name: annoName, query } = annotation.useState();

  const name = useMemo(() => {
    if (query.enable === false) {
      return (
        <span className={styles.muted}>
          <Trans i18nKey="dashboard-scene.annotations-section.name-disabled" values={{ annoName }}>
            (Disabled) {'{{annoName}}'}
          </Trans>
        </span>
      );
    }
    if (query.builtIn) {
      return (
        <span className={styles.muted}>
          <Trans i18nKey="dashboard-scene.annotations-section.name-builtin" values={{ annoName }}>
            {'{{annoName}}'} (Built-in)
          </Trans>
        </span>
      );
    }
    return annoName;
  }, [annoName, query.builtIn, query.enable, styles.muted]);

  return (
    <div>
      <span
        className={styles.color}
        style={{
          backgroundColor: theme.visualization.getColorByName(query.iconColor),
        }}
      />
      {name}
    </div>
  );
}

export function partitionAnnotationsByDisplay(annotationLayers: SceneDataLayerProvider[]) {
  const {
    visible = [],
    controlsMenu = [],
    hidden = [],
  } = partitionSceneObjects(
    annotationLayers.filter((a) => a instanceof DashboardAnnotationsDataLayer),
    (a) => {
      if (a.state.isHidden) {
        return 'hidden';
      }
      if (a.state.placement === 'inControlsMenu') {
        return 'controlsMenu';
      }
      return 'visible';
    }
  );
  return { visible, controlsMenu, hidden };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    ...getDraggableListStyles(theme),
    color: css({
      display: 'inline-block',
      width: theme.spacing(1),
      height: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.text.primary,
      marginRight: theme.spacing(0.5),
    }),
    muted: css({
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
  };
}
