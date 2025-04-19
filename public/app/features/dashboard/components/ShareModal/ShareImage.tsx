import { saveAs } from 'file-saver';
import { useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { SelectableValue } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { Button, Field, Modal, RadioButtonGroup, Spinner, Alert } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { ShareModalTabProps } from './types';
import { buildDashboardImageUrl, buildImageUrl } from './utils';

interface Props extends ShareModalTabProps {}

enum ImageFormat {
  PNG = 'png',
  JPG = 'jpg',
}

const styles = {
  loadingContainer: {
    margin: '16px 0',
    textAlign: 'center' as const,
  },
  loadingText: {
    marginTop: '16px',
    color: 'var(--text-secondary)',
  },
  imageContainer: {
    margin: '16px 0',
    textAlign: 'center' as const,
  },
  image: {
    maxWidth: '100%',
    maxHeight: '400px',
    objectFit: 'contain' as const,
  },
};

export function ShareImage({ dashboard, panel, onDismiss }: Props) {
  const [format, setFormat] = useState<ImageFormat>(ImageFormat.PNG);
  const [isLoading, setIsLoading] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFormatChange = (newFormat: ImageFormat) => {
    setFormat(newFormat);
  };

  const onExport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!config.rendererAvailable) {
        throw new Error('Image renderer service is not available');
      }

      // Use the appropriate URL building function based on whether we're sharing a dashboard or panel
      const imageUrl = panel
        ? buildImageUrl(true, dashboard.uid, config.theme2.isDark ? 'dark' : 'light', panel)
        : buildDashboardImageUrl(true, dashboard.uid, config.theme2.isDark ? 'dark' : 'light', dashboard);

      // Fetch the image as a blob
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

  const onSave = () => {
    if (!imageBlob) {
      return;
    }

    const time = new Date().getTime();
    const name = panel ? panel.title : dashboard.title;
    saveAs(imageBlob, `${name}-${time}.${format}`);
  };

  const formatOptions: Array<SelectableValue<ImageFormat>> = [
    { label: t('share-modal.image.format-png', 'PNG'), value: ImageFormat.PNG },
    { label: t('share-modal.image.format-jpg', 'JPG'), value: ImageFormat.JPG },
  ];

  return (
    <>
      <p>
        <Trans i18nKey="share-modal.image.info-text">
          Export the {{ type: panel ? 'panel' : 'dashboard' }} as an image file. The image will be captured at high
          resolution.
        </Trans>
      </p>
      {/* TODO: Replace this with general message from other areas */}
      {!config.rendererAvailable && (
        <Alert severity="info" title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}>
          <Trans i18nKey="share-modal.link.render-instructions">
            To render a {{ type: panel ? 'panel' : 'dashboard' }} image, you must install the{' '}
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
      <Field label={t('share-modal.image.format-label', 'Format')}>
        <RadioButtonGroup options={formatOptions} value={format} onChange={onFormatChange} />
      </Field>
      {isLoading && (
        <div style={styles.loadingContainer}>
          <Spinner size="xl" />
          <p style={styles.loadingText}>
            <Trans i18nKey="share-modal.image.generating-text">Generating image...</Trans>
          </p>
        </div>
      )}
      {error && !isLoading && (
        <Alert severity="error" title={t('share-modal.image.error-title', 'Failed to generate image')}>
          {error}
        </Alert>
      )}
      {imageBlob && !isLoading && !error && (
        <div style={styles.imageContainer}>
          <img
            src={URL.createObjectURL(imageBlob)}
            alt={t('share-modal.image.preview', 'Preview')}
            style={styles.image}
          />
        </div>
      )}
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="share-modal.image.cancel-button">Cancel</Trans>
        </Button>
        {!imageBlob ? (
          <Button variant="primary" onClick={onExport} disabled={isLoading || !config.rendererAvailable}>
            {isLoading ? (
              <Trans i18nKey="share-modal.image.exporting-button">Generating...</Trans>
            ) : (
              <Trans i18nKey="share-modal.image.export-button">Generate</Trans>
            )}
          </Button>
        ) : (
          <Button variant="primary" onClick={onSave}>
            <Trans i18nKey="share-modal.image.save-button">Save Image</Trans>
          </Button>
        )}
      </Modal.ButtonRow>
    </>
  );
}
