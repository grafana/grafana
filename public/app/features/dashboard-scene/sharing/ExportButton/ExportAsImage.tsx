import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useState } from 'react';
import { useMeasure } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Field, LoadingBar, RadioButtonGroup, Alert, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { ShareExportTab } from '../ShareExportTab';

enum ImageFormat {
  PNG = 'png',
  JPG = 'jpg',
}

export class ExportAsImage extends ShareExportTab {
  public tabId = shareDashboardType.image;
  static Component = ExportAsImageRenderer;

  public getTabLabel() {
    return t('share-modal.tab-title.export-image', 'Export image');
  }
}

function ExportAsImageRenderer({ model }: SceneComponentProps<ExportAsImage>) {
  const [format, setFormat] = useState<ImageFormat>(ImageFormat.PNG);
  const [isLoading, setIsLoading] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles2(getStyles);
  const [ref, { width: loadingBarWidth }] = useMeasure<HTMLDivElement>();

  const dashboard = getDashboardSceneFor(model);

  const onFormatChange = (value: ImageFormat) => {
    setFormat(value);
  };

  const onExport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!config.rendererAvailable) {
        throw new Error('Image renderer plugin not installed');
      }

      // Calculate dimensions
      const height = calculateDashboardHeight(dashboard);
      const scale = config.rendererDefaultImageScale || 1;
      const scaledHeight = Math.round(height * scale);

      // Use a width that matches the dashboard's grid system (24 columns)
      const GRID_COLUMN_COUNT = 24;
      const GRID_CELL_WIDTH = 70; // Approximate width per grid column
      const width = Math.round(GRID_COLUMN_COUNT * GRID_CELL_WIDTH * scale);

      const imageUrl = getDashboardUrl({
        uid: dashboard.state.uid,
        currentQueryParams: location.search,
        updateQuery: {
          theme: config.theme2.isDark ? 'dark' : 'light',
          width,
          height: scaledHeight,
          scale,
          kiosk: true,
          hideNav: true,
          orgId: String(config.bootData.user.orgId),
          fullPageImage: true,
        },
        absolute: true,
        render: true,
      });

      const response = await lastValueFrom(
        getBackendSrv().fetch<BlobPart>({
          url: imageUrl,
          responseType: 'blob',
        })
      );

      if (!response.ok) {
        throw new Error(`Failed to generate image: ${response.status} ${response.statusText}`);
      }

      const blob = new Blob([response.data], { type: `image/${format}` });
      setImageBlob(blob);

      DashboardInteractions.toolbarShareClick();
    } catch (error) {
      console.error('Error exporting image:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  };

  const onDownload = () => {
    if (!imageBlob) {
      return;
    }

    const time = new Date().getTime();
    const name = dashboard.state.title;
    saveAs(imageBlob, `${name}-${time}.${format}`);
  };

  const formatOptions = [
    { label: 'PNG', value: ImageFormat.PNG },
    { label: 'JPG', value: ImageFormat.JPG },
  ];

  return (
    <>
      <p className={styles.info}>
        <Trans i18nKey="share-modal.image.info-text">
          Save this dashboard as an image file. The image will be captured at high resolution.
        </Trans>
      </p>

      <Field label={t('share-modal.image.format-label', 'Format')}>
        <RadioButtonGroup options={formatOptions} value={format} onChange={onFormatChange} />
      </Field>

      {!config.rendererAvailable && (
        <Alert severity="info" title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}>
          <Trans i18nKey="share-modal.link.render-instructions">
            To render a dashboard image, you must install the{' '}
            <a
              href="https://grafana.com/grafana/plugins/grafana-image-renderer"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Grafana image renderer plugin
            </a>
            . Please contact your Grafana administrator to install the plugin.
          </Trans>
        </Alert>
      )}

      <div className={styles.buttonRow}>
        {!imageBlob ? (
          <Button
            variant="primary"
            onClick={onExport}
            disabled={isLoading || !config.rendererAvailable}
            icon="document-info"
          >
            <Trans i18nKey="share-modal.image.generate-button">Generate image</Trans>
          </Button>
        ) : (
          <Button variant="primary" onClick={onDownload} icon="download-alt">
            <Trans i18nKey="share-modal.image.download-button">Download image</Trans>
          </Button>
        )}
        <Button variant="secondary" onClick={model.useState().onDismiss} fill="outline">
          <Trans i18nKey="share-modal.image.cancel-button">Cancel</Trans>
        </Button>
      </div>

      <div className={styles.previewContainer} ref={ref}>
        <div className={styles.loadingBarContainer}>{isLoading && <LoadingBar width={loadingBarWidth} />}</div>

        {error && !isLoading && (
          <Alert severity="error" title={t('share-modal.image.error-title', 'Failed to generate image')}>
            {error}
          </Alert>
        )}

        {imageBlob && !isLoading && !error && (
          <img
            src={URL.createObjectURL(imageBlob)}
            alt={t('share-modal.image.preview', 'Preview')}
            className={styles.image}
          />
        )}
      </div>
    </>
  );
}

function calculateDashboardHeight(dashboard: DashboardScene): number {
  // First try to calculate based on grid layout
  let totalHeight = 0;
  const layout = dashboard.state.body;

  if (layout instanceof DefaultGridLayoutManager) {
    const gridItems = layout.state.grid.state.children.filter(
      (item): item is DashboardGridItem => item instanceof DashboardGridItem
    );
    for (const item of gridItems) {
      const itemHeight = item.state.height ?? 0;
      const y = item.state.y ?? 0;
      totalHeight = Math.max(totalHeight, y + itemHeight);
    }

    // Convert grid units to pixels and add extra padding
    const GRID_CELL_HEIGHT = 30;
    const GRID_CELL_MARGIN = 8;
    const EXTRA_PADDING = 100; // Additional padding to ensure we capture everything

    // Calculate total height with margins between panels
    totalHeight = totalHeight * GRID_CELL_HEIGHT + (totalHeight - 1) * GRID_CELL_MARGIN + EXTRA_PADDING;
  }

  // Get the dashboard container
  const dashboardContainer = document.querySelector('.dashboard-container');
  if (dashboardContainer instanceof HTMLElement) {
    // Get all panels
    const panels = document.querySelectorAll('.panel-container');
    let maxPanelBottom = 0;

    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      maxPanelBottom = Math.max(maxPanelBottom, rect.bottom);
    });

    // Get the container's top position
    const containerRect = dashboardContainer.getBoundingClientRect();
    const containerTop = containerRect.top;

    // Calculate height based on the difference between the bottom-most panel and container top
    const heightFromPanels = maxPanelBottom - containerTop + 100; // Add 100px padding

    // Use the maximum of grid calculation and panel positions
    totalHeight = Math.max(totalHeight, heightFromPanels);
  }

  // Ensure we have a minimum height
  const MIN_HEIGHT = 500;
  return Math.max(totalHeight, MIN_HEIGHT);
}

const getStyles = (theme: GrafanaTheme2) => ({
  info: css({
    marginBottom: theme.spacing(2),
  }),
  previewContainer: css({
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
    minHeight: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  }),
  loadingBarContainer: css({
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 1,
  }),
  image: css({
    maxWidth: '100%',
    width: 'max-content',
    display: 'block',
  }),
  buttonRow: css({
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-start',
    marginBottom: theme.spacing(2),
  }),
});
