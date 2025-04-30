import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Field, LoadingBar, RadioButtonGroup, Alert, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';

import { ShareExportTab } from '../ShareExportTab';

import { generateDashboardImage } from './utils';

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
      const result = await generateDashboardImage({
        dashboard,
        format,
        scale: config.rendererDefaultImageScale || 1,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setImageBlob(result.blob);
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
