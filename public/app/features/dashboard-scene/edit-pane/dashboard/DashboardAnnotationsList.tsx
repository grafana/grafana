import { css } from '@emotion/css';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type SceneDataLayerProvider } from '@grafana/scenes';
import { Box, Button, useStyles2, useTheme2 } from '@grafana/ui';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { type DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { getDashboardSceneFor } from '../../utils/utils';
import { useBuildAddAnnotation } from '../add-new/AddAnnotationQuery';
import { dashboardEditActions } from '../shared';

import { DraggableList } from './DraggableList';
import { partitionSceneObjects } from './helpers';

const ID_VISIBLE_LIST = 'annotations-list-visible';
const ID_CONTROLS_MENU_LIST = 'annotations-list-controls-menu';
const ID_HIDDEN_LIST = 'annotations-list-hidden';

const DROPPABLE_TO_PLACEMENT: Record<string, { isHidden: boolean; placement?: 'inControlsMenu' }> = {
  [ID_VISIBLE_LIST]: { isHidden: false, placement: undefined },
  [ID_CONTROLS_MENU_LIST]: { isHidden: false, placement: 'inControlsMenu' },
  [ID_HIDDEN_LIST]: { isHidden: true, placement: undefined },
};

export function DashboardAnnotationsList({ dataLayerSet }: { dataLayerSet: DashboardDataLayerSet }) {
  const { annotationLayers } = dataLayerSet.useState();
  const { visible, controlsMenu, hidden } = useMemo(
    () => partitionAnnotationsByDisplay(annotationLayers),
    [annotationLayers]
  );

  const onClickAnnotation = useCallback((a: DashboardAnnotationsDataLayer) => {
    const { editPane } = getDashboardSceneFor(a).state;
    editPane.selectObject(a);
  }, []);

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
      const lists: Record<string, DashboardAnnotationsDataLayer[]> = {
        [ID_VISIBLE_LIST]: [...visible],
        [ID_CONTROLS_MENU_LIST]: [...controlsMenu],
        [ID_HIDDEN_LIST]: [...hidden],
      };

      const sourceList = lists[source.droppableId];
      const destList = isSameList ? sourceList : lists[destination.droppableId];

      const [moved] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, moved);

      const oldState = {
        isHidden: moved.state.isHidden,
        placement: moved.state.placement,
        query: { ...moved.state.query },
      };

      const { isHidden, placement } = DROPPABLE_TO_PLACEMENT[destination.droppableId];
      const newState = {
        isHidden,
        placement,
        query: { ...moved.state.query, hide: isHidden, placement },
      };

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
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <DraggableList
          items={visible}
          droppableId={ID_VISIBLE_LIST}
          title={t(
            'dashboard-scene.dashboard-annotations-list.title-above-dashboard-count',
            'Above dashboard ({{count}})',
            { count: visible.length }
          )}
          onClickItem={onClickAnnotation}
          renderItemLabel={renderItemLabel}
        />
        <DraggableList
          items={controlsMenu}
          droppableId={ID_CONTROLS_MENU_LIST}
          title={t(
            'dashboard-scene.dashboard-annotations-list.title-controls-menu-count',
            'Controls menu ({{count}})',
            {
              count: controlsMenu.length,
            }
          )}
          onClickItem={onClickAnnotation}
          renderItemLabel={renderItemLabel}
        />
        <DraggableList
          items={hidden}
          droppableId={ID_HIDDEN_LIST}
          title={t('dashboard-scene.dashboard-annotations-list.title-hidden-count', 'Hidden ({{count}})', {
            count: hidden.length,
          })}
          onClickItem={onClickAnnotation}
          renderItemLabel={renderItemLabel}
        />
      </DragDropContext>
      <AddAnnotationButton dataLayerSet={dataLayerSet} />
    </>
  );
}

const renderItemLabel = (a: DashboardAnnotationsDataLayer) => <AnnotationName annotation={a} />;

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
    <>
      <span
        className={styles.color}
        style={{
          backgroundColor: theme.visualization.getColorByName(query.iconColor),
        }}
      />
      <span data-testid="annotation-name">{name}</span>
    </>
  );
}

function AddAnnotationButton({ dataLayerSet }: { dataLayerSet: DashboardDataLayerSet }) {
  const onClickAddAnnotation = useBuildAddAnnotation(dataLayerSet);

  return (
    <Box display="flex" paddingTop={1} paddingBottom={1}>
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
