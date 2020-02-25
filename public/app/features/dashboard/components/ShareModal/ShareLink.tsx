import React, { PureComponent } from 'react';
import { Switch, Select, ClipboardButton } from '@grafana/ui';
import { SelectableValue, PanelModel, AppEvents } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state';
import { buildImageUrl, buildShareUrl } from './utils';
import { appEvents } from 'app/core/core';

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
  shareUrl: string;
  imageUrl: string;
}

export class ShareLink extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      useCurrentTimeRange: true,
      includeTemplateVars: true,
      selectedTheme: themeOptions[0],
      shareUrl: '',
      imageUrl: '',
    };
  }

  componentDidMount() {
    this.buildUrl();
  }

  buildUrl = () => {
    const { panel } = this.props;
    const { useCurrentTimeRange, includeTemplateVars, selectedTheme } = this.state;

    const shareUrl = buildShareUrl(panel, useCurrentTimeRange, includeTemplateVars, selectedTheme.value);
    const imageUrl = buildImageUrl(panel, useCurrentTimeRange, includeTemplateVars, selectedTheme.value);
    this.setState({ shareUrl, imageUrl });
  };

  onUseCurrentTimeRangeChange = () => {
    this.setState(
      {
        useCurrentTimeRange: !this.state.useCurrentTimeRange,
      },
      this.buildUrl
    );
  };

  onIncludeTemplateVarsChange = () => {
    this.setState(
      {
        includeTemplateVars: !this.state.includeTemplateVars,
      },
      this.buildUrl
    );
  };

  onThemeChange = (value: SelectableValue<string>) => {
    this.setState(
      {
        selectedTheme: value,
      },
      this.buildUrl
    );
  };

  onShareUrlCopy = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
  };

  getShareUrl = () => {
    return this.state.shareUrl;
  };

  render() {
    const { panel } = this.props;
    const { useCurrentTimeRange, includeTemplateVars, selectedTheme, shareUrl, imageUrl } = this.state;

    return (
      <div className="share-modal-body">
        <div className="share-modal-header">
          <div className="share-modal-big-icon">
            <i className="gicon gicon-link"></i>
          </div>
          <div className="share-modal-content">
            <p className="share-modal-info-text">
              Create a direct link to this dashboard or panel, customized with the options below.
            </p>
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
            <div>
              <div className="gf-form-group">
                <div className="gf-form-inline">
                  <div className="gf-form gf-form--grow">
                    <input type="text" className="gf-form-input" defaultValue={shareUrl} />
                  </div>
                  <div className="gf-form">
                    <ClipboardButton variant="inverse" getText={this.getShareUrl} onClipboardCopy={this.onShareUrlCopy}>
                      Copy
                    </ClipboardButton>
                    {/* <button className="btn btn-inverse" clipboard-button="getShareUrl()">Copy</button> */}
                  </div>
                </div>
              </div>
            </div>
            {panel && (
              <div className="gf-form">
                <a href={imageUrl} target="_blank">
                  <i className="fa fa-camera"></i> Direct link rendered image
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
