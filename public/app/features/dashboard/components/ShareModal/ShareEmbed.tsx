import React, { FormEvent, PureComponent } from 'react';
import { RadioButtonGroup, Switch, Field, TextArea, ClipboardButton } from '@grafana/ui';
import { SelectableValue, AppEvents } from '@grafana/data';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { appEvents } from 'app/core/core';
import { buildIframeHtml } from './utils';

const themeOptions: Array<SelectableValue<string>> = [
  { label: 'Current', value: 'current' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
];

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;
}

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
    this.buildIframeHtml();
  }

  buildIframeHtml = () => {
    const { panel } = this.props;
    const { useCurrentTimeRange, selectedTheme } = this.state;

    const iframeHtml = buildIframeHtml(useCurrentTimeRange, selectedTheme, panel);
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

  onIframeHtmlCopy = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
  };

  getIframeHtml = () => {
    return this.state.iframeHtml;
  };

  render() {
    const { useCurrentTimeRange, selectedTheme, iframeHtml } = this.state;
    const isRelativeTime = this.props.dashboard ? this.props.dashboard.time.to === 'now' : false;

    return (
      <>
        <p className="share-modal-info-text">Generate HTML for embedding an iframe with this panel.</p>
        <Field
          label="Current time range"
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
        <Field
          label="Embed HTML"
          description="The HTML code below can be pasted and included in another web page. Unless anonymous access is enabled, 
                the user viewing that page need to be signed into Grafana for the graph to load."
        >
          <TextArea rows={5} value={iframeHtml} onChange={this.onIframeHtmlChange}></TextArea>
        </Field>
        <ClipboardButton variant="primary" getText={this.getIframeHtml} onClipboardCopy={this.onIframeHtmlCopy}>
          Copy to clipboard
        </ClipboardButton>
      </>
    );
  }
}
