import React, { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Alert, Button, Field, FieldSet, Input, LoadingPlaceholder, RadioButtonGroup, Switch } from '@grafana/ui';
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
}

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
    };
  }

  componentDidMount() {
    this.buildUrl();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { useCurrentTimeRange, selectedTheme } = this.state;
    if (prevState.useCurrentTimeRange !== useCurrentTimeRange || prevState.selectedTheme !== selectedTheme) {
      this.buildUrl();
    }
  }

  buildUrl = async () => {
    const { panel, dashboard } = this.props;
    const { useCurrentTimeRange, selectedTheme } = this.state;

    const imageUrl = buildImageUrl(useCurrentTimeRange, dashboard.uid, selectedTheme, panel);

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

  onDownload = () => {
    const request = new XMLHttpRequest();
    request.responseType = 'blob';
    request.open('GET', this.state.imageUrl);
    request.addEventListener('error', () => {
      console.log('error');
      this.setState({ isDownloading: false });
    });
    request.addEventListener('load', () => {
      const a = document.createElement('a');
      const url = URL.createObjectURL(request.response);
      a.href = url;
      a.download = this.props.panel?.title + '.' + this.state.selectedFormat;
      a.click();

      this.setState({ isDownloading: false });
    });
    request.send();
    this.setState({ isDownloading: true });
  };

  render() {
    const { panel, dashboard } = this.props;
    const isRelativeTime = dashboard ? dashboard.time.to === 'now' : false;
    const { useCurrentTimeRange, selectedTheme, selectedFormat, width, height, isDownloading } = this.state;
    const isDashboardSaved = Boolean(dashboard.id);

    const timeRangeLabelTranslation = t('share-modal.link.time-range-label', `Lock time range`);
    const widthTranslation = t('share-modal.image.width', `Width`);
    const heightTranslation = t('share-modal.image.height', `Height`);

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

              <Field label={widthTranslation}>
                <Input id="image-width-input" type="number" width={15} value={width} onChange={this.onWidthChange} />
              </Field>

              <Field label={heightTranslation}>
                <Input id="image-height-input" width={15} value={height} onChange={this.onHeightChange} />
              </Field>

              <Field label={t('share-modal.image.format', `Image format`)}>
                <RadioButtonGroup options={imageFormats} value={selectedFormat} onChange={this.onFormatChange} />
              </Field>

              {isDashboardSaved && !isDownloading && (
                <Button aria-label="Download image" variant="primary" onClick={this.onDownload} type="button">
                  {t('share-modal.image.download-button-label', `Download image`)}
                </Button>
                // <div className="gf-form">
                //   <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={selectors.linkToRenderedImage}>
                //     <Icon name="camera" />
                //     &nbsp;
                //     <Trans i18nKey="share-modal.link.rendered-image">Direct link rendered image</Trans>
                //   </a>
                // </div>
              )}

              {isDashboardSaved && isDownloading && <LoadingPlaceholder text="Loading..." />}

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
