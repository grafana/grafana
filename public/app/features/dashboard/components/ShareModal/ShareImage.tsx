import React, { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Alert, Button, Field, FieldSet, Input, RadioButtonGroup, Spinner, Switch } from '@grafana/ui';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';

import { ThemePicker } from './ThemePicker';
import { ShareModalTabProps } from './types';
import { buildImageUrl } from './utils';

export interface Props extends ShareModalTabProps {}

export interface State {
  useCurrentTimeRange: boolean;
  selectedTheme: string;
  selectedFormat: string;
  imageUrl: string;
  width: number;
  height: number;
  isDownloading: boolean;
  usePanelSize: boolean;
  error: string | null;
}

const ERROR_MSG = "Couldn't render image";

export class ShareImage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      useCurrentTimeRange: true,
      selectedTheme: 'current',
      selectedFormat: 'png',
      imageUrl: '',
      width: 1000,
      height: 500,
      isDownloading: false,
      usePanelSize: false,
      error: null,
    };
  }

  componentDidMount() {
    this.buildUrl();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { useCurrentTimeRange, selectedTheme, width, height, usePanelSize } = this.state;
    if (
      prevState.useCurrentTimeRange !== useCurrentTimeRange ||
      prevState.selectedTheme !== selectedTheme ||
      prevState.width !== width ||
      prevState.height !== height ||
      prevState.usePanelSize !== usePanelSize
    ) {
      this.buildUrl();
    }
  }

  buildUrl = async () => {
    const { panel, dashboard, panelSize } = this.props;
    const { useCurrentTimeRange, selectedTheme, width, height } = this.state;

    const usedWidth = this.state.usePanelSize ? panelSize?.width ?? width : width;
    const usedHeight = this.state.usePanelSize ? panelSize?.height ?? height : height;

    const imageUrl = buildImageUrl(
      useCurrentTimeRange,
      dashboard.uid,
      selectedTheme,
      panel,
      Math.floor(usedWidth),
      Math.floor(usedHeight)
    );

    this.setState({ imageUrl });
  };

  onUseCurrentTimeRangeChange = () => {
    this.setState({ useCurrentTimeRange: !this.state.useCurrentTimeRange });
  };

  onThemeChange = (value: string) => {
    this.setState({ selectedTheme: value });
  };

  onWidthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ width: Number(event.target.value) });
  };

  onHeightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ height: Number(event.target.value) });
  };

  onFormatChange = (value: string) => {
    this.setState({ selectedFormat: value });
  };

  onPanelSizeFlagChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ usePanelSize: event.currentTarget.checked });
  };

  onDownload = () => {
    this.setState({ isDownloading: true, error: null });
    fetch(this.state.imageUrl)
      .then((response) => {
        if (!response.ok) {
          this.setState({ isDownloading: false, error: ERROR_MSG });
          throw new Error(ERROR_MSG);
        }
        return response.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = this.props.panel?.title + '.' + this.state.selectedFormat;
        link.click();

        this.setState({ isDownloading: false, error: null });
      })
      .catch((error) => {
        this.setState({ isDownloading: false, error: error.message });
      });
  };

  render() {
    const { panel, dashboard } = this.props;
    const isRelativeTime = dashboard ? dashboard.time.to === 'now' : false;
    const { useCurrentTimeRange, selectedTheme, selectedFormat, width, height, isDownloading, usePanelSize, error } =
      this.state;
    const isDashboardSaved = Boolean(dashboard.id);

    const timeRangeLabelTranslation = t('share-modal.link.time-range-label', `Lock time range`);
    const widthTranslation = t('share-modal.image.width', `Image width`);
    const heightTranslation = t('share-modal.image.height', `Image height`);
    const usePanelSizeTranslation = t('share-modal.image.use-panel-size', 'Use panel size');

    const panelSizeTranslation = t(
      'share-modal.image.use-panel-size-description',
      `Use the same width and height as the panel`
    );

    const timeRangeDescriptionTranslation = t(
      'share-modal.link.time-range-description',
      `Transforms the current relative time range to an absolute time range`
    );

    const imageFormats: Array<SelectableValue<string>> = [
      {
        label: 'PNG',
        value: 'png',
      },
      {
        label: 'JPG',
        value: 'jpg',
      },
      {
        label: 'BMP',
        value: 'bmp',
      },
    ];

    return (
      <>
        {panel && config.rendererAvailable && (
          <>
            <p className="share-modal-info-text">
              <Trans i18nKey="share-modal.image.info-text">Download a snapshot of the panel as an image.</Trans>
            </p>
            <FieldSet>
              <Field
                label={timeRangeLabelTranslation}
                description={isRelativeTime ? timeRangeDescriptionTranslation : ''}
              >
                <Switch
                  id="share-current-time-range"
                  value={useCurrentTimeRange}
                  onChange={this.onUseCurrentTimeRangeChange}
                />
              </Field>
              <ThemePicker selectedTheme={selectedTheme} onChange={this.onThemeChange} />
              <Field label={t('share-modal.image.format', `Image format`)}>
                <RadioButtonGroup options={imageFormats} value={selectedFormat} onChange={this.onFormatChange} />
              </Field>
              <FieldSet>
                <Field label={usePanelSizeTranslation} description={panelSizeTranslation}>
                  <Switch id="image-panel-size" value={usePanelSize} onChange={this.onPanelSizeFlagChange} />
                </Field>
                {!usePanelSize && (
                  <>
                    <Field label={widthTranslation}>
                      <Input
                        id="image-width-input"
                        type="number"
                        width={15}
                        value={width}
                        onChange={this.onWidthChange}
                      />
                    </Field>
                    <Field label={heightTranslation}>
                      <Input id="image-height-input" width={15} value={height} onChange={this.onHeightChange} />
                    </Field>
                  </>
                )}
              </FieldSet>

              {isDashboardSaved && (
                <div style={{ marginBottom: '10px' }}>
                  <Button
                    fullWidth={true}
                    aria-label="Download image"
                    variant="primary"
                    onClick={this.onDownload}
                    type="button"
                    disabled={isDownloading}
                  >
                    {t('share-modal.image.download-button-label', `Download image`)}
                    {isDownloading && <Spinner inline={true} style={{ marginLeft: '10px' }} />}
                  </Button>
                </div>
              )}

              {error && (
                <Alert severity="error" title={t('share-modal.image.error', 'Error')} bottomSpacing={0}>
                  {error}
                </Alert>
              )}

              {!isDashboardSaved && (
                <Alert
                  severity="info"
                  title={t('share-modal.link.save-alert', 'Dashboard is not saved')}
                  bottomSpacing={0}
                >
                  <Trans i18nKey="share-modal.link.save-dashboard">
                    To render a panel image, you must save the dashboard first.
                  </Trans>
                </Alert>
              )}
            </FieldSet>
          </>
        )}

        {panel && !config.rendererAvailable && (
          <Alert
            severity="info"
            title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
            bottomSpacing={0}
          >
            <Trans i18nKey="share-modal.link.render-instructions">
              To render a panel image, you must install the
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
      </>
    );
  }
}
