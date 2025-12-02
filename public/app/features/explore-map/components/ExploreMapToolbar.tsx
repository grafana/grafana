import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, ButtonGroup, ConfirmModal, Input, ToolbarButton, UsersIndicator, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useTransformContext } from '../context/TransformContext';
import { useCanvasPersistence } from '../hooks/useCanvasPersistence';
import { updateMapTitle } from '../state/crdtSlice';
import { selectPanelCount, selectViewport, selectMapTitle, selectActiveUsers } from '../state/selectors';

interface ExploreMapToolbarProps {
  uid?: string;
}

export function ExploreMapToolbar({ uid }: ExploreMapToolbarProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { exportCanvas, importCanvas, saving, lastSaved } = useCanvasPersistence({ uid });
  const { transformRef } = useTransformContext();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const panelCount = useSelector((state) => selectPanelCount(state.exploreMapCRDT));
  const viewport = useSelector((state) => selectViewport(state.exploreMapCRDT));
  const mapTitle = useSelector((state) => selectMapTitle(state.exploreMapCRDT));
  const activeUsers = useSelector((state) => selectActiveUsers(state.exploreMapCRDT));

  useEffect(() => {
    if (mapTitle) {
      setTitleValue(mapTitle);
    }
  }, [mapTitle]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const handleResetCanvas = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const confirmResetCanvas = useCallback(() => {
    // TODO: Implement resetCanvas for CRDT state
    // dispatch(resetCanvas());
    console.warn('Reset canvas not yet implemented for CRDT state');
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

  const handleTitleClick = useCallback(() => {
    if (uid) {
      // Only allow editing in API mode
      setEditingTitle(true);
    }
  }, [uid]);

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== mapTitle) {
      dispatch(updateMapTitle({ title: titleValue.trim() }));
    } else {
      setTitleValue(mapTitle || '');
    }
  }, [dispatch, mapTitle, titleValue]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTitleBlur();
      } else if (e.key === 'Escape') {
        setTitleValue(mapTitle || '');
        setEditingTitle(false);
      }
    },
    [handleTitleBlur, mapTitle]
  );

  const getSaveStatus = () => {
    if (!uid) {
      return null; // No status in localStorage mode
    }
    if (saving) {
      return <span className={styles.saveStatus}>Saving...</span>;
    }
    if (lastSaved) {
      const secondsAgo = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (secondsAgo < 5) {
        return <span className={styles.saveStatus}>Saved</span>;
      }
    }
    return null;
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarSection}>
          {uid && (
            <Button
              icon="arrow-left"
              variant="secondary"
              size="sm"
              onClick={() => (window.location.href = '/explore-maps')}
              tooltip="Back to maps list"
              fill="text"
            />
          )}
          {uid && mapTitle !== undefined ? (
            editingTitle ? (
              <Input
                ref={titleInputRef}
                value={titleValue}
                onChange={(e) => setTitleValue(e.currentTarget.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className={styles.titleInput}
              />
            ) : (
              <div className={styles.titleDisplay} onClick={handleTitleClick}>
                <h2 className={styles.title}>{mapTitle || 'Untitled Map'}</h2>
                <span className="fa fa-pencil" />
              </div>
            )
          ) : (
            <span className={styles.panelCount}>
              <Trans i18nKey="explore-map.toolbar.panel-count" values={{ count: panelCount }}>
                {{ count: panelCount }} panels
              </Trans>
            </span>
          )}
          {getSaveStatus()}
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
          {activeUsers.length > 0 && (
            <div className={styles.activeUsersContainer}>
              <UsersIndicator users={activeUsers} limit={5} />
            </div>
          )}
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
    titleDisplay: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1),
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      transition: 'background-color 0.2s',
      '&:hover': {
        backgroundColor: theme.colors.background.primary,
        '& .fa-pencil': {
          opacity: 1,
        },
      },
      '& .fa-pencil': {
        opacity: 0.5,
        fontSize: theme.typography.bodySmall.fontSize,
        color: theme.colors.text.secondary,
      },
    }),
    title: css({
      margin: 0,
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.h4.fontWeight,
    }),
    titleInput: css({
      width: '300px',
    }),
    saveStatus: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    activeUsersContainer: css({
      display: 'flex',
      alignItems: 'center',
      marginRight: theme.spacing(2),
    }),
  };
};
