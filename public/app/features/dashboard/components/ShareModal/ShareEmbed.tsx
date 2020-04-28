import React, { PureComponent } from 'react';
import { LegacyForms, Icon } from '@grafana/ui';
const { Select, Switch } = LegacyForms;
import { SelectableValue } from '@grafana/data';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { buildIframeHtml } from './utils';

const themeOptions: Array<SelectableValue<string>> = [
  { label: 'current', value: 'current' },
  { label: 'dark', value: 'dark' },
  { label: 'light', value: 'light' },
];

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;
}

interface State {
  useCurrentTimeRange: boolean;
  includeTemplateVars: boolean;
  selectedTheme: SelectableValue<string>;
  iframeHtml: string;
}

export class ShareEmbed extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      useCurrentTimeRange: true,
      includeTemplateVars: true,
      selectedTheme: themeOptions[0],
      iframeHtml: '',
    };
  }

  componentDidMount() {
    this.buildIframeHtml();
  }

  buildIframeHtml = () => {
    const { panel } = this.props;
    const { useCurrentTimeRange, includeTemplateVars, selectedTheme } = this.state;

    const iframeHtml = buildIframeHtml(useCurrentTimeRange, includeTemplateVars, selectedTheme.value, panel);
    this.setState({ iframeHtml });
  };

  onUseCurrentTimeRangeChange = () => {
    this.setState(
      {
        useCurrentTimeRange: !this.state.useCurrentTimeRange,
      },
      this.buildIframeHtml
    );
  };

  onIncludeTemplateVarsChange = () => {
    this.setState(
      {
        includeTemplateVars: !this.state.includeTemplateVars,
      },
      this.buildIframeHtml
    );
  };

  onThemeChange = (value: SelectableValue<string>) => {
    this.setState(
      {
        selectedTheme: value,
      },
      this.buildIframeHtml
    );
  };

  render() {
    const { useCurrentTimeRange, includeTemplateVars, selectedTheme, iframeHtml } = this.state;

    return (
      <div className="share-modal-body">
        <div className="share-modal-header">
          <Icon name="link" className="share-modal-big-icon" size="xxl" />
          <div className="share-modal-content">
            <div className="gf-form-group">
              <Switch
                labelClass="width-12"
                label="Current time range"
                checked={useCurrentTimeRange}
                onChange={this.onUseCurrentTimeRangeChange}
              />
              <Switch
                labelClass="width-12"
                label="Template variables"
                checked={includeTemplateVars}
                onChange={this.onIncludeTemplateVarsChange}
              />
              <div className="gf-form">
                <label className="gf-form-label width-12">Theme</label>
                <Select width={10} options={themeOptions} value={selectedTheme} onChange={this.onThemeChange} />
              </div>
            </div>

            <p className="share-modal-info-text">
              The html code below can be pasted and included in another web page. Unless anonymous access is enabled,
              the user viewing that page need to be signed into grafana for the graph to load.
            </p>

            <div className="gf-form-group gf-form--grow">
              <div className="gf-form">
                <textarea rows={5} data-share-panel-url className="gf-form-input" defaultValue={iframeHtml}></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
