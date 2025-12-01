import { css, cx } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';
import { Rnd, RndDragCallback, RndResizeCallback } from 'react-rnd';

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
  updateMultiplePanelPositions,
  updatePanelPosition,
  updatePanelSize,
} from '../state/crdtSlice';
import { selectSelectedPanelIds, selectViewport } from '../state/selectors';
import { ExploreMapPanel } from '../state/types';

import { ExploreMapPanelContent } from './ExploreMapPanelContent';

interface ExploreMapPanelContainerProps {
  panel: ExploreMapPanel;
}

export function ExploreMapPanelContainer({ panel }: ExploreMapPanelContainerProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const rndRef = useRef<Rnd>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  const selectedPanelIds = useSelector((state) => selectSelectedPanelIds(state.exploreMapCRDT));
  const viewport = useSelector((state) => selectViewport(state.exploreMapCRDT));
  const isSelected = selectedPanelIds.includes(panel.id);

  const handleDragStart: RndDragCallback = useCallback(
    (_e, data) => {
      setDragStartPos({ x: data.x, y: data.y });
    },
    []
  );

  const handleDrag: RndDragCallback = useCallback(
    (_e, data) => {
      if (!dragStartPos) {
        return;
      }

      const deltaX = data.x - dragStartPos.x;
      const deltaY = data.y - dragStartPos.y;

      // If this panel is selected and there are multiple selections, move all others
      if (isSelected && selectedPanelIds.length > 1) {
        dispatch(
          updateMultiplePanelPositions({
            panelId: panel.id,
            deltaX,
            deltaY,
          })
        );
        setDragStartPos({ x: data.x, y: data.y });
      }
    },
    [dispatch, panel.id, dragStartPos, isSelected, selectedPanelIds.length]
  );

  const handleDragStop: RndDragCallback = useCallback(
    (_e, data) => {
      if (dragStartPos) {
        const deltaX = data.x - dragStartPos.x;
        const deltaY = data.y - dragStartPos.y;

        // Only update position if there was actual movement
        const hasMoved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

        if (hasMoved) {
          // Final position update for all panels
          if (isSelected && selectedPanelIds.length > 1) {
            // Update other panels with the remaining delta
            dispatch(
              updateMultiplePanelPositions({
                panelId: panel.id,
                deltaX,
                deltaY,
              })
            );
            // Update the dragged panel's position in Redux
            dispatch(
              updatePanelPosition({
                panelId: panel.id,
                x: data.x,
                y: data.y,
              })
            );
          } else {
            // Single panel drag
            dispatch(
              updatePanelPosition({
                panelId: panel.id,
                x: data.x,
                y: data.y,
              })
            );
          }
        }
      }
      setDragStartPos(null);
    },
    [dispatch, panel.id, dragStartPos, isSelected, selectedPanelIds.length]
  );

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, position) => {
      const newWidth = ref.offsetWidth;
      const newHeight = ref.offsetHeight;

      // Update position
      dispatch(
        updatePanelPosition({
          panelId: panel.id,
          x: position.x,
          y: position.y,
        })
      );

      // Update size
      dispatch(
        updatePanelSize({
          panelId: panel.id,
          width: newWidth,
          height: newHeight,
        })
      );

      // Trigger resize event for Explore components
      window.dispatchEvent(new Event('resize'));
    },
    [dispatch, panel.id]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux) key
      const isMultiSelect = e.metaKey || e.ctrlKey;

      // If this panel is already selected and we're not multi-selecting,
      // don't change selection (allows dragging multiple selected panels)
      if (isSelected && !isMultiSelect) {
        dispatch(bringPanelToFront({ panelId: panel.id }));
        return;
      }

      dispatch(selectPanel({ panelId: panel.id, addToSelection: isMultiSelect }));

      // Only bring to front if not multi-selecting
      if (!isMultiSelect) {
        dispatch(bringPanelToFront({ panelId: panel.id }));
      }
    },
    [dispatch, panel.id, isSelected]
  );

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
      onDragStart={handleDragStart}
      onDrag={handleDrag}
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
            panelId={panel.id}
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
