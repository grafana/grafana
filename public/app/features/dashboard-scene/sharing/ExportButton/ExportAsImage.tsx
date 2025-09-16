import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Alert, Button, TextLink, useStyles2 } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';

import { ImagePreview } from '../components/ImagePreview';
import { SceneShareTabState, ShareView } from '../types';

import { generateDashboardImage } from './utils';

export class ExportAsImage extends SceneObjectBase<SceneShareTabState> implements ShareView {
  static Component = ExportAsImageRenderer;

  public getTabLabel() {
    return t('share-modal.image.title', 'Export as image');
  }
}

function ExportAsImageRenderer({ model }: SceneComponentProps<ExportAsImage>) {
  const { onDismiss } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const styles = useStyles2(getStyles);

  const [{ loading: isLoading, value: imageBlob, error }, onExport] = useAsyncFn(async () => {
    try {
      const result = await generateDashboardImage({
        dashboard,
        scale: config.rendererDefaultImageScale || 1,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      DashboardInteractions.generateDashboardImageClicked({
        scale: config.rendererDefaultImageScale || 1,
        shareResource: 'dashboard',
        success: true,
      });

      return result.blob;
    } catch (error) {
      console.error('Error exporting image:', error);
      DashboardInteractions.generateDashboardImageClicked({
        scale: config.rendererDefaultImageScale || 1,
        shareResource: 'dashboard',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate image',
      });
      throw error; // Re-throw to let useAsyncFn handle the error state
    }
  }, [dashboard]);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (imageBlob) {
        URL.revokeObjectURL(URL.createObjectURL(imageBlob));
      }
    };
  }, [imageBlob]);

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
    <main>
      <p className={styles.info}>
        <Trans i18nKey="share-modal.image.info-text">Save this dashboard as an image</Trans>
      </p>

      <div
        className={styles.buttonRow}
        role="group"
        aria-label={t('share-modal.image.actions', 'Image export actions')}
      >
        {!imageBlob ? (
          <Button
            variant="primary"
            onClick={onExport}
            disabled={isLoading}
            icon="gf-layout-simple"
            aria-describedby={isLoading ? 'generate-status' : undefined}
          >
            <Trans i18nKey="share-modal.image.generate-button">Generate image</Trans>
          </Button>
        ) : (
          <Button variant="primary" onClick={onDownload} icon="download-alt">
            <Trans i18nKey="share-modal.image.download-button">Download image</Trans>
          </Button>
        )}
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="share-modal.image.cancel-button">Cancel</Trans>
        </Button>
      </div>

      {isLoading && (
        <div id="generate-status" aria-live="polite" className="sr-only">
          <Trans i18nKey="share-modal.image.generating">Generating image...</Trans>
        </div>
      )}

      <ImagePreview
        imageBlob={imageBlob || null}
        isLoading={isLoading}
        error={
          error
            ? {
                title: t('share-modal.image.error-title', 'Failed to generate image'),
                message: error instanceof Error ? error.message : 'Failed to generate image',
              }
            : null
        }
        title={dashboard.state.title}
      />
    </main>
  );
}

function RendererAlert() {
  if (config.rendererAvailable) {
    return null;
  }

  return (
    <Alert severity="info" title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}>
      <div>{t('share-modal.link.render-alert', 'Image renderer plugin not installed')}</div>
      <div>
        <Trans i18nKey="share-modal.link.render-instructions">
          To render an image, you must install the{' '}
          <TextLink href="https://grafana.com/grafana/plugins/grafana-image-renderer" external>
            Grafana image renderer plugin
          </TextLink>
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
