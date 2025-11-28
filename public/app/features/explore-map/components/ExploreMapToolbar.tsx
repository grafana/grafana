import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, ButtonGroup, ConfirmModal, ToolbarButton, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useTransformContext } from '../context/TransformContext';
import { useCanvasPersistence } from '../hooks/useCanvasPersistence';
import { addPanel, resetCanvas } from '../state/exploreMapSlice';

export function ExploreMapToolbar() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { exportCanvas, importCanvas } = useCanvasPersistence();
  const { transformRef } = useTransformContext();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const panelCount = useSelector((state) => Object.keys(state.exploreMap.panels).length);
  const viewport = useSelector((state) => state.exploreMap.viewport);

  const handleAddPanel = useCallback(() => {
    dispatch(addPanel({
      viewportSize: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }));
  }, [dispatch]);

  const handleResetCanvas = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const confirmResetCanvas = useCallback(() => {
    dispatch(resetCanvas());
    setShowResetConfirm(false);
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
      // Reset to center of canvas (5000, 5000)
      // Calculate position to center the viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panX = -(5000 - viewportWidth / 2);
      const panY = -(5000 - viewportHeight / 2);

      transformRef.current.setTransform(panX, panY, 1, 200);
    }
  }, [transformRef]);

  const handleExport = useCallback(() => {
    exportCanvas();
  }, [exportCanvas]);

  const handleImport = useCallback(() => {
    importCanvas();
  }, [importCanvas]);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarSection}>
          <Button icon="plus" onClick={handleAddPanel} variant="primary">
            <Trans i18nKey="explore-map.toolbar.add-panel">Add Panel</Trans>
          </Button>
          <span className={styles.panelCount}>
            <Trans i18nKey="explore-map.toolbar.panel-count" values={{ count: panelCount }}>
              {{ count: panelCount }} panels
            </Trans>
          </span>
        </div>

        <div className={styles.toolbarSection}>
          <ButtonGroup>
            <ToolbarButton
              icon="search-minus"
              onClick={handleZoomOut}
              tooltip={t('explore-map.toolbar.zoom-out', 'Zoom out')}
            />
            <ToolbarButton onClick={handleResetZoom} tooltip={t('explore-map.toolbar.reset-zoom', 'Reset zoom')}>
              {Math.round(viewport.zoom * 100)}%
            </ToolbarButton>
            <ToolbarButton icon="search-plus" onClick={handleZoomIn} tooltip={t('explore-map.toolbar.zoom-in', 'Zoom in')} />
          </ButtonGroup>
        </div>

        <div className={styles.toolbarSection}>
          <ButtonGroup>
            <ToolbarButton
              icon="save"
              onClick={handleExport}
              tooltip={t('explore-map.toolbar.export', 'Export canvas')}
            />
            <ToolbarButton
              icon="upload"
              onClick={handleImport}
              tooltip={t('explore-map.toolbar.import', 'Import canvas')}
            />
            <ToolbarButton
              icon="trash-alt"
              onClick={handleResetCanvas}
              tooltip={t('explore-map.toolbar.clear', 'Clear all panels')}
              variant="destructive"
            />
          </ButtonGroup>
        </div>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        title={t('explore-map.toolbar.confirm-reset.title', 'Clear all panels')}
        body={t(
          'explore-map.toolbar.confirm-reset.body',
          'Are you sure you want to clear all panels? This cannot be undone.'
        )}
        confirmText={t('explore-map.toolbar.confirm-reset.confirm', 'Clear')}
        onConfirm={confirmResetCanvas}
        onDismiss={() => setShowResetConfirm(false)}
      />
    </>
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
