import { css, cx } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2, IconButton, Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { CatalogPlugin } from '../types';

const buildScreenshotPath = (plugin: CatalogPlugin, path: string) => {
  return `${config.appSubUrl}/api/gnet/plugins/${plugin.id}/versions/${plugin.latestVersion}/images/${path}`;
};

interface PluginScreenshotCarouselProps {
  plugin: CatalogPlugin;
  screenshots: Array<{
    path: string;
    name: string;
  }>;
}

export const PluginScreenshotCarousel: React.FC<PluginScreenshotCarouselProps> = ({ screenshots, plugin }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [validScreenshots, setValidScreenshots] = useState<typeof screenshots>(screenshots);

  const styles = useStyles2(getStyles);

  const handleImageError = (path: string) => {
    setImageErrors((prev) => ({
      ...prev,
      [path]: true,
    }));
  };

  useEffect(() => {
    const filteredScreenshots = screenshots.filter((screenshot) => !imageErrors[screenshot.path]);
    setValidScreenshots(filteredScreenshots);
  }, [imageErrors, screenshots]);

  const openPreview = (index: number) => {
    setSelectedIndex(index);
  };

  const closePreview = () => {
    setSelectedIndex(null);
  };

  const goToNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % validScreenshots.length);
    }
  };

  const goToPrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + validScreenshots.length) % validScreenshots.length);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (selectedIndex === null) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
        goToNext();
        break;
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'Escape':
        closePreview();
        break;
      default:
        break;
    }
  };

  if (validScreenshots.length === 0) {
    return (
      <Alert
        title={t('plugin.details.screenshots.warning', 'Something went wrong loading screenshots')}
        severity="warning"
      />
    );
  }

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      <div className={cx(styles.screenshotGrid)}>
        {validScreenshots.map((screenshot, index) => (
          <div key={screenshot.path} onClick={() => openPreview(index)} style={{ cursor: 'pointer' }}>
            <img
              src={buildScreenshotPath(plugin, screenshot.path)}
              alt={screenshot.name}
              onError={() => handleImageError(screenshot.path)}
            />
            <p>{screenshot.name}</p>
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <div className={cx(styles.fullScreenDiv)} onClick={closePreview} data-testid="plugin-screenshot-full-screen">
          <IconButton
            name="times"
            aria-label={t('plugin.details.screenshots.closeFullScreen', 'Close')}
            size="xl"
            onClick={closePreview}
            className={cx(styles.closeButton)}
          />

          <IconButton
            size="xl"
            name="angle-left"
            aria-label={t('plugin.details.screenshots.previousFullScreen', 'Previous')}
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className={cx(styles.navigationButton, styles.previousButton)}
          />

          <div
            style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}
            onClick={(e) => e.stopPropagation()}
            data-testid="plugin-screenshot-full-image"
          >
            <img
              src={buildScreenshotPath(plugin, validScreenshots[selectedIndex].path)}
              alt={validScreenshots[selectedIndex].name}
              onError={() => handleImageError(validScreenshots[selectedIndex].path)}
            />
          </div>

          <IconButton
            size="xl"
            name="angle-right"
            aria-label={t('plugin.details.screenshots.nextFullScreen', 'Next')}
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className={cx(styles.navigationButton, styles.nextButton)}
          />
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  screenshotGrid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',

    '& img': {
      width: '100%',
      height: '150px',
      objectFit: 'cover',
      border: theme.colors.border.strong,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z1,
    },
    '& p': {
      margin: '4px 0',
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    },
  }),
  fullScreenDiv: css({
    position: 'fixed',
    zIndex: theme.zIndex.modalBackdrop,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.components.overlay.background,
    backdropFilter: 'blur(1px)',
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',

    '& img': {
      maxWidth: '100%',
      maxHeight: '80vh',
      objectFit: 'contain',
    },
  }),
  closeButton: css({
    position: 'absolute',
    top: '20px',
    right: '20px',
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
  }),
  navigationButton: css({
    position: 'absolute',
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  nextButton: css({
    right: '20px',
  }),
  previousButton: css({
    left: '20px',
  }),
});
