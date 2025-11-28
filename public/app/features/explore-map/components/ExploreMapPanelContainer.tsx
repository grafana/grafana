import { css, cx } from '@emotion/css';
import { useCallback, useRef } from 'react';
import { DraggableData, Rnd, RndResizeCallback } from 'react-rnd';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { splitClose } from '../../explore/state/main';
import {
  bringPanelToFront,
  duplicatePanel,
  removePanel,
  selectPanel,
  updatePanelPosition,
} from '../state/exploreMapSlice';
import { ExploreMapPanel } from '../state/types';

import { ExploreMapPanelContent } from './ExploreMapPanelContent';

interface ExploreMapPanelContainerProps {
  panel: ExploreMapPanel;
}

export function ExploreMapPanelContainer({ panel }: ExploreMapPanelContainerProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const rndRef = useRef<Rnd>(null);

  const selectedPanelId = useSelector((state) => state.exploreMap.selectedPanelId);
  const viewport = useSelector((state) => state.exploreMap.viewport);
  const isSelected = selectedPanelId === panel.id;

  const handleDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, data: DraggableData) => {
      dispatch(
        updatePanelPosition({
          panelId: panel.id,
          position: { x: data.x, y: data.y },
        })
      );
    },
    [dispatch, panel.id]
  );

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, position) => {
      const newWidth = ref.offsetWidth;
      const newHeight = ref.offsetHeight;

      dispatch(
        updatePanelPosition({
          panelId: panel.id,
          position: {
            x: position.x,
            y: position.y,
            width: newWidth,
            height: newHeight,
          },
        })
      );

      // Trigger resize event for Explore components
      window.dispatchEvent(new Event('resize'));
    },
    [dispatch, panel.id]
  );

  const handleMouseDown = useCallback(() => {
    dispatch(selectPanel({ panelId: panel.id }));
    dispatch(bringPanelToFront({ panelId: panel.id }));
  }, [dispatch, panel.id]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Clean up Explore state first
      dispatch(splitClose(panel.exploreId));
      // Then remove panel
      dispatch(removePanel({ panelId: panel.id }));
    },
    [dispatch, panel.id, panel.exploreId]
  );

  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(duplicatePanel({ panelId: panel.id }));
    },
    [dispatch, panel.id]
  );

  return (
    <Rnd
      ref={rndRef}
      position={{ x: panel.position.x, y: panel.position.y }}
      size={{ width: panel.position.width, height: panel.position.height }}
      scale={viewport.zoom}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={handleMouseDown}
      bounds="parent"
      dragHandleClassName="panel-drag-handle"
      className={cx(styles.panelContainer, { [styles.selectedPanel]: isSelected })}
      style={{ zIndex: panel.position.zIndex }}
      minWidth={300}
      minHeight={200}
    >
      <div className={styles.panel}>
        <div className={cx(styles.panelHeader, 'panel-drag-handle')}>
          <div className={styles.panelTitle}>
            {t('explore-map.panel.title', 'Explore Panel {{id}}', { id: panel.id.slice(0, 8) })}
          </div>
          <div className={styles.panelActions}>
            <Button
              icon="copy"
              variant="secondary"
              size="sm"
              fill="text"
              onClick={handleDuplicate}
              tooltip={t('explore-map.panel.duplicate', 'Duplicate panel')}
            />
            <Button
              icon="times"
              variant="secondary"
              size="sm"
              fill="text"
              onClick={handleRemove}
              tooltip={t('explore-map.panel.remove', 'Remove')}
            />
          </div>
        </div>
        <div className={styles.panelContent}>
          <ExploreMapPanelContent
            exploreId={panel.exploreId}
            width={panel.position.width}
            height={panel.position.height - 36}
          />
        </div>
      </div>
    </Rnd>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    panelContainer: css({
      cursor: 'default',
    }),
    panel: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      boxShadow: theme.shadows.z2,
    }),
    selectedPanel: css({
      '& > div': {
        border: `2px solid ${theme.colors.primary.border}`,
      },
    }),
    panelHeader: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1.5),
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'move',
      minHeight: '36px',
    }),
    panelTitle: css({
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      userSelect: 'none',
    }),
    panelActions: css({
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    panelContent: css({
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
    }),
  };
};
