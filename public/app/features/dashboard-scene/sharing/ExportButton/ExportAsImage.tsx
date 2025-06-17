import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';

import { ImagePreview } from '../components/ImagePreview';
import { ShareView } from '../types';

import { generateDashboardImage, ImageGenerationError } from './utils';

type ErrorState = {
  message: string;
  title: string;
  code?: ImageGenerationError;
} | null;

export interface ExportAsImageState extends SceneObjectState {
  onDismiss: () => void;
}

export class ExportAsImage extends SceneObjectBase<ExportAsImageState> implements ShareView {
  static Component = ExportAsImageRenderer;

  public getTabLabel() {
    return t('share-modal.image.title', 'Export as image');
  }
}

function ExportAsImageRenderer({ model }: SceneComponentProps<ExportAsImage>) {
  const { onDismiss } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const [isLoading, setIsLoading] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<ErrorState>(null);
  const styles = useStyles2(getStyles);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (imageBlob) {
        URL.revokeObjectURL(URL.createObjectURL(imageBlob));
      }
    };
  }, [imageBlob]);

  const onExport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await generateDashboardImage({
        dashboard,
        scale: config.rendererDefaultImageScale || 1,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setImageBlob(result.blob);
      DashboardInteractions.generateDashboardImageClicked({
        scale: config.rendererDefaultImageScale || 1,
        shareResource: 'dashboard',
        success: true,
      });
    } catch (error) {
      console.error('Error exporting image:', error);
      DashboardInteractions.generateDashboardImageClicked({
        scale: config.rendererDefaultImageScale || 1,
        shareResource: 'dashboard',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate image',
      });
      setError({
        title: t('share-modal.image.error-title', 'Failed to generate image'),
        message: error instanceof Error ? error.message : 'Failed to generate image',
      });
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
    saveAs(imageBlob, `${name}-${time}.png`);

    DashboardInteractions.downloadDashboardImageClicked({
      fileName: `${name}-${time}.png`,
      shareResource: 'dashboard',
    });
  };

  if (!config.rendererAvailable) {
    return <RendererAlert />;
  }

  return (
    <>
      <p className={styles.info}>
        <Trans i18nKey="share-modal.image.info-text">Save this dashboard as an image</Trans>
      </p>

      <div className={styles.buttonRow}>
        {!imageBlob ? (
          <Button
            variant="primary"
            onClick={onExport}
            disabled={isLoading}
            icon="gf-layout-simple"
            data-testid={selectors.components.ExportImage.buttons.generate}
          >
            <Trans i18nKey="share-modal.image.generate-button">Generate image</Trans>
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onDownload}
            icon="download-alt"
            data-testid={selectors.components.ExportImage.buttons.download}
          >
            <Trans i18nKey="share-modal.image.download-button">Download image</Trans>
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onDismiss}
          fill="outline"
          data-testid={selectors.components.ExportImage.buttons.cancel}
        >
          <Trans i18nKey="share-modal.image.cancel-button">Cancel</Trans>
        </Button>
      </div>

      <ImagePreview
        imageBlob={imageBlob}
        isLoading={isLoading}
        error={error}
        testId={selectors.components.ExportImage.preview.container}
        title={dashboard.state.title}
        showLoading={!!imageBlob || isLoading}
      />
    </>
  );
}

function RendererAlert() {
  if (config.rendererAvailable) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
      data-testid={selectors.components.ExportImage.rendererAlert.container}
    >
      <div data-testid={selectors.components.ExportImage.rendererAlert.title}>
        {t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
      </div>
      <div data-testid={selectors.components.ExportImage.rendererAlert.description}>
        <Trans i18nKey="share-modal.link.render-instructions">
          To render an image, you must install the{' '}
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
      </div>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  info: css({
    marginBottom: theme.spacing(2),
  }),
  buttonRow: css({
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  }),
});
