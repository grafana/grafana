import { saveAs } from 'file-saver';
import { PureComponent } from 'react';
import { lastValueFrom } from 'rxjs';

import { SelectableValue } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { Button, Field, Modal, RadioButtonGroup, Spinner, Alert } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { ShareModalTabProps } from './types';
import { buildDashboardImageUrl, buildImageUrl } from './utils';

interface Props extends ShareModalTabProps {}

interface State {
  format: 'png' | 'jpg';
  isLoading: boolean;
  imageBlob: Blob | null;
  error: string | null;
}

export class ShareImage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      format: 'png',
      isLoading: false,
      imageBlob: null,
      error: null,
    };
  }

  onFormatChange = (format: 'png' | 'jpg') => {
    this.setState({ format });
  };

  onExport = async () => {
    const { dashboard, panel } = this.props;
    const { format } = this.state;

    this.setState({ isLoading: true, error: null });

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
      this.setState({ imageBlob: blob });

      DashboardInteractions.toolbarShareClick();
    } catch (error) {
      console.error('Error exporting image:', error);
      this.setState({
        error: error instanceof Error ? error.message : 'Failed to generate image',
      });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  onSave = () => {
    const { dashboard, panel } = this.props;
    const { imageBlob, format } = this.state;

    if (!imageBlob) {
      return;
    }

    const time = new Date().getTime();
    const name = panel ? panel.title : dashboard.title;
    saveAs(imageBlob, `${name}-${time}.${format}`);
  };

  render() {
    const { onDismiss } = this.props;
    const { format, isLoading, imageBlob, error } = this.state;

    const formatOptions: Array<SelectableValue<'png' | 'jpg'>> = [
      { label: t('share-modal.image.format-png', 'PNG'), value: 'png' },
      { label: t('share-modal.image.format-jpg', 'JPG'), value: 'jpg' },
    ];

    return (
      <>
        <p>
          <Trans i18nKey="share-modal.image.info-text">
            Export the {{ type: this.props.panel ? 'panel' : 'dashboard' }} as an image file. The image will be captured
            at high resolution.
          </Trans>
        </p>
        {/* TODO: Replace this with general message from other areas */}
        {!config.rendererAvailable && (
          <Alert severity="info" title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}>
            <Trans i18nKey="share-modal.link.render-instructions">
              To render a {{ type: this.props.panel ? 'panel' : 'dashboard' }} image, you must install the{' '}
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
          <RadioButtonGroup options={formatOptions} value={format} onChange={this.onFormatChange} />
        </Field>
        {isLoading && (
          <div style={{ margin: '16px 0', textAlign: 'center' }}>
            <Spinner size="xl" />
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
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
          <div style={{ margin: '16px 0', textAlign: 'center' }}>
            <img
              src={URL.createObjectURL(imageBlob)}
              alt={t('share-modal.image.preview', 'Preview')}
              style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
            />
          </div>
        )}
        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="share-modal.image.cancel-button">Cancel</Trans>
          </Button>
          {!imageBlob ? (
            <Button variant="primary" onClick={this.onExport} disabled={isLoading || !config.rendererAvailable}>
              {isLoading ? (
                <Trans i18nKey="share-modal.image.exporting-button">Generating...</Trans>
              ) : (
                <Trans i18nKey="share-modal.image.export-button">Generate</Trans>
              )}
            </Button>
          ) : (
            <Button variant="primary" onClick={this.onSave}>
              <Trans i18nKey="share-modal.image.save-button">Save Image</Trans>
            </Button>
          )}
        </Modal.ButtonRow>
      </>
    );
  }
}
