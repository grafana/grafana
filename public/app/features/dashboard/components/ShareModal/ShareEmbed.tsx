import React, { FormEvent, PureComponent } from 'react';

import { reportInteraction } from '@grafana/runtime/src';
import { ClipboardButton, Field, Modal, Switch, TextArea } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ThemePicker } from './ThemePicker';
import { ShareModalTabProps } from './types';
import { buildIframeHtml } from './utils';

interface Props extends ShareModalTabProps {}

interface State {
  useCurrentTimeRange: boolean;
  selectedTheme: string;
  iframeHtml: string;
}

export class ShareEmbed extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      useCurrentTimeRange: true,
      selectedTheme: 'current',
      iframeHtml: '',
    };
  }

  componentDidMount() {
    reportInteraction('grafana_dashboards_embed_share_viewed');
    this.buildIframeHtml();
  }

  buildIframeHtml = () => {
    const { panel, dashboard } = this.props;
    const { useCurrentTimeRange, selectedTheme } = this.state;

    const iframeHtml = buildIframeHtml(useCurrentTimeRange, dashboard.uid, selectedTheme, panel);
    this.setState({ iframeHtml });
  };

  onIframeHtmlChange = (event: FormEvent<HTMLTextAreaElement>) => {
    this.setState({ iframeHtml: event.currentTarget.value });
  };

  onUseCurrentTimeRangeChange = () => {
    this.setState(
      {
        useCurrentTimeRange: !this.state.useCurrentTimeRange,
      },
      this.buildIframeHtml
    );
  };

  onThemeChange = (value: string) => {
    this.setState({ selectedTheme: value }, this.buildIframeHtml);
  };

  getIframeHtml = () => {
    return this.state.iframeHtml;
  };

  render() {
    const { useCurrentTimeRange, selectedTheme, iframeHtml } = this.state;
    const isRelativeTime = this.props.dashboard ? this.props.dashboard.time.to === 'now' : false;

    const timeRangeDescription = isRelativeTime
      ? t(
          'share-modal.embed.time-range-description',
          'Transforms the current relative time range to an absolute time range'
        )
      : '';

    return (
      <>
        <p className="share-modal-info-text">
          <Trans i18nKey="share-modal.embed.info">Generate HTML for embedding an iframe with this panel.</Trans>
        </p>
        <Field label={t('share-modal.embed.time-range', 'Current time range')} description={timeRangeDescription}>
          <Switch
            id="share-current-time-range"
            value={useCurrentTimeRange}
            onChange={this.onUseCurrentTimeRangeChange}
          />
        </Field>
        <ThemePicker selectedTheme={selectedTheme} onChange={this.onThemeChange} />
        <Field
          label={t('share-modal.embed.html', 'Embed HTML')}
          description={t(
            'share-modal.embed.html-description',
            'The HTML code below can be pasted and included in another web page. Unless anonymous access is enabled, the user viewing that page need to be signed into Grafana for the graph to load.'
          )}
        >
          <TextArea
            data-testid="share-embed-html"
            id="share-panel-embed-embed-html-textarea"
            rows={5}
            value={iframeHtml}
            onChange={this.onIframeHtmlChange}
          />
        </Field>
        <Modal.ButtonRow>
          <ClipboardButton icon="copy" variant="primary" getText={this.getIframeHtml}>
            <Trans i18nKey="share-modal.embed.copy">Copy to clipboard</Trans>
          </ClipboardButton>
        </Modal.ButtonRow>
      </>
    );
  }
}
