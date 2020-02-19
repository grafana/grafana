import React, { PureComponent } from 'react';
import { Button, Switch, Select } from '@grafana/ui';
import { SelectableValue, dateTime } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { appendQueryToUrl, toUrlParams, getUrlSearchParams } from 'app/core/utils/url';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import templateSrv from 'app/features/templating/template_srv';

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

    let baseUrl = window.location.href;
    const queryStart = baseUrl.indexOf('?');

    if (queryStart !== -1) {
      baseUrl = baseUrl.substring(0, queryStart);
    }

    const params = getUrlSearchParams();
    params.orgId = config.bootData.user.orgId;

    const range = getTimeSrv().timeRange();
    params.from = range.from.valueOf();
    params.to = range.to.valueOf();

    if (!useCurrentTimeRange) {
      delete params.from;
      delete params.to;
    }

    if (includeTemplateVars) {
      templateSrv.fillVariableValuesForUrl(params);
    }

    if (selectedTheme.value !== 'current') {
      params.theme = selectedTheme.value;
    }

    if (panel) {
      params.panelId = panel.id;
      params.fullscreen = true;
    } else {
      delete params.panelId;
      delete params.fullscreen;
    }

    const shareUrl = appendQueryToUrl(baseUrl, toUrlParams(params));

    let soloUrl = baseUrl.replace(config.appSubUrl + '/dashboard/', config.appSubUrl + '/dashboard-solo/');
    soloUrl = soloUrl.replace(config.appSubUrl + '/d/', config.appSubUrl + '/d-solo/');
    delete params.fullscreen;
    delete params.edit;
    soloUrl = appendQueryToUrl(soloUrl, toUrlParams(params));

    // const iframeHtml = '<iframe src="' + soloUrl + '" width="450" height="200" frameborder="0"></iframe>';

    let imageUrl = soloUrl.replace(config.appSubUrl + '/dashboard-solo/', config.appSubUrl + '/render/dashboard-solo/');
    imageUrl = imageUrl.replace(config.appSubUrl + '/d-solo/', config.appSubUrl + '/render/d-solo/');
    imageUrl += '&width=1000&height=500' + this.getLocalTimeZone();

    this.setState({ shareUrl, imageUrl });
  };

  getLocalTimeZone = () => {
    const utcOffset = '&tz=UTC' + encodeURIComponent(dateTime().format('Z'));

    // Older browser does not the internationalization API
    if (!(window as any).Intl) {
      return utcOffset;
    }

    const dateFormat = (window as any).Intl.DateTimeFormat();
    if (!dateFormat.resolvedOptions) {
      return utcOffset;
    }

    const options = dateFormat.resolvedOptions();
    if (!options.timeZone) {
      return utcOffset;
    }

    return '&tz=' + encodeURIComponent(options.timeZone);
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
                    <Button variant="inverse">Copy</Button>
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
