import { css } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ButtonGroup, ToolbarButton, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useTransformContext } from '../context/TransformContext';
import { useCanvasPersistence } from '../hooks/useCanvasPersistence';
import { addPanel, resetCanvas } from '../state/exploreMapSlice';

export function ExploreMapToolbar() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { exportCanvas, importCanvas } = useCanvasPersistence();
  const { transformRef } = useTransformContext();

  const panelCount = useSelector((state) => Object.keys(state.exploreMap.panels).length);
  const viewport = useSelector((state) => state.exploreMap.viewport);

  const handleAddPanel = useCallback(() => {
    dispatch(addPanel({}));
  }, [dispatch]);

  const handleResetCanvas = useCallback(() => {
    if (confirm('Are you sure you want to clear all panels? This cannot be undone.')) {
      dispatch(resetCanvas());
    }
  }, [dispatch]);

  const handleZoomIn = useCallback(() => {
    if (transformRef?.current) {
      transformRef.current.zoomIn(0.2);
    }
  }, [transformRef]);

  const handleZoomOut = useCallback(() => {
    if (transformRef?.current) {
      transformRef.current.zoomOut(0.2);
    }
  }, [transformRef]);

  const handleResetZoom = useCallback(() => {
    if (transformRef?.current) {
      transformRef.current.resetTransform();
    }
  }, [transformRef]);

  const handleExport = useCallback(() => {
    exportCanvas();
  }, [exportCanvas]);

  const handleImport = useCallback(() => {
    importCanvas();
  }, [importCanvas]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarSection}>
        <Button icon="plus" onClick={handleAddPanel} variant="primary">
          Add Panel
        </Button>
        <span className={styles.panelCount}>{panelCount} panels</span>
      </div>

      <div className={styles.toolbarSection}>
        <ButtonGroup>
          <ToolbarButton icon="search-minus" onClick={handleZoomOut} tooltip="Zoom out" />
          <ToolbarButton onClick={handleResetZoom} tooltip="Reset zoom">
            {Math.round(viewport.zoom * 100)}%
          </ToolbarButton>
          <ToolbarButton icon="search-plus" onClick={handleZoomIn} tooltip="Zoom in" />
        </ButtonGroup>
      </div>

      <div className={styles.toolbarSection}>
        <ButtonGroup>
          <ToolbarButton icon="save" onClick={handleExport} tooltip="Export canvas" />
          <ToolbarButton icon="upload" onClick={handleImport} tooltip="Import canvas" />
          <ToolbarButton icon="trash-alt" onClick={handleResetCanvas} tooltip="Clear all panels" variant="destructive" />
        </ButtonGroup>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    toolbar: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 2),
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      minHeight: '48px',
      gap: theme.spacing(2),
    }),
    toolbarSection: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    panelCount: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
  };
};
