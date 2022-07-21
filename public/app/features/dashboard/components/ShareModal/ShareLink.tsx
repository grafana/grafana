import React, { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime/src';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, RadioButtonGroup, Switch } from '@grafana/ui';
import config from 'app/core/config';

import { ShareModalTabProps } from './types';
import { buildImageUrl, buildShareUrl } from './utils';

const themeOptions: Array<SelectableValue<string>> = [
  { label: 'Current', value: 'current' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
];

export interface Props extends ShareModalTabProps {}

export interface State {
  useCurrentTimeRange: boolean;
  useShortUrl: boolean;
  selectedTheme: string;
  shareUrl: string;
  imageUrl: string;
}

export class ShareLink extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      useCurrentTimeRange: true,
      useShortUrl: false,
      selectedTheme: 'current',
      shareUrl: '',
      imageUrl: '',
    };
  }

  componentDidMount() {
    reportInteraction('grafana_dashboards_link_share_viewed');
    this.buildUrl();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { useCurrentTimeRange, useShortUrl, selectedTheme } = this.state;
    if (
      prevState.useCurrentTimeRange !== useCurrentTimeRange ||
      prevState.selectedTheme !== selectedTheme ||
      prevState.useShortUrl !== useShortUrl
    ) {
      this.buildUrl();
    }
  }

  buildUrl = async () => {
    const { panel, dashboard } = this.props;
    const { useCurrentTimeRange, useShortUrl, selectedTheme } = this.state;

    const shareUrl = await buildShareUrl(useCurrentTimeRange, selectedTheme, panel, useShortUrl);
    const imageUrl = buildImageUrl(useCurrentTimeRange, dashboard.uid, selectedTheme, panel);

    this.setState({ shareUrl, imageUrl });
  };

  onUseCurrentTimeRangeChange = () => {
    this.setState({ useCurrentTimeRange: !this.state.useCurrentTimeRange });
  };

  onUrlShorten = () => {
    this.setState({ useShortUrl: !this.state.useShortUrl });
  };

  onThemeChange = (value: string) => {
    this.setState({ selectedTheme: value });
  };

  getShareUrl = () => {
    return this.state.shareUrl;
  };

  render() {
    const { panel, dashboard } = this.props;
    const isRelativeTime = dashboard ? dashboard.time.to === 'now' : false;
    const { useCurrentTimeRange, useShortUrl, selectedTheme, shareUrl, imageUrl } = this.state;
    const selectors = e2eSelectors.pages.SharePanelModal;
    const isDashboardSaved = Boolean(dashboard.id);

    return (
      <>
        <p className="share-modal-info-text">
          Create a direct link to this dashboard or panel, customized with the options below.
        </p>
        <FieldSet>
          <Field
            label="Lock time range"
            description={isRelativeTime ? 'Transforms the current relative time range to an absolute time range' : ''}
          >
            <Switch
              id="share-current-time-range"
              value={useCurrentTimeRange}
              onChange={this.onUseCurrentTimeRangeChange}
            />
          </Field>
          <Field label="Theme">
            <RadioButtonGroup options={themeOptions} value={selectedTheme} onChange={this.onThemeChange} />
          </Field>
          <Field label="Shorten URL">
            <Switch id="share-shorten-url" value={useShortUrl} onChange={this.onUrlShorten} />
          </Field>

          <Field label="Link URL">
            <Input
              id="link-url-input"
              value={shareUrl}
              readOnly
              addonAfter={
                <ClipboardButton icon="copy" variant="primary" getText={this.getShareUrl}>
                  Copy
                </ClipboardButton>
              }
            />
          </Field>
        </FieldSet>

        {panel && config.rendererAvailable && (
          <>
            {isDashboardSaved && (
              <div className="gf-form">
                <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={selectors.linkToRenderedImage}>
                  <Icon name="camera" /> Direct link rendered image
                </a>
              </div>
            )}

            {!isDashboardSaved && (
              <Alert severity="info" title="Dashboard is not saved" bottomSpacing={0}>
                To render a panel image, you must save the dashboard first.
              </Alert>
            )}
          </>
        )}

        {panel && !config.rendererAvailable && (
          <Alert severity="info" title="Image renderer plugin not installed" bottomSpacing={0}>
            <>To render a panel image, you must install the </>
            <a
              href="https://grafana.com/grafana/plugins/grafana-image-renderer"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Grafana image renderer plugin
            </a>
            . Please contact your Grafana administrator to install the plugin.
          </Alert>
        )}
      </>
    );
  }
}
