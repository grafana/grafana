import React from 'react';
import { MetricDescriptor } from '../types';
import { Icon } from '@grafana/ui';

export interface Props {
  rawQuery: string;
  lastQueryError: string;
  metricDescriptor?: MetricDescriptor;
}

interface State {
  displayHelp: boolean;
  displaRawQuery: boolean;
}

export class Help extends React.Component<Props, State> {
  state: State = {
    displayHelp: false,
    displaRawQuery: false,
  };

  onHelpClicked = () => {
    this.setState({ displayHelp: !this.state.displayHelp });
  };

  onRawQueryClicked = () => {
    this.setState({ displaRawQuery: !this.state.displaRawQuery });
  };

  shouldComponentUpdate(nextProps: Props) {
    return nextProps.metricDescriptor !== null;
  }

  render() {
    const { displayHelp, displaRawQuery } = this.state;
    const { rawQuery, lastQueryError } = this.props;

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form" onClick={this.onHelpClicked}>
            <label className="gf-form-label query-keyword pointer">
              Show Help <Icon name={displayHelp ? 'angle-down' : 'angle-right'} />
            </label>
          </div>

          {rawQuery && (
            <div className="gf-form" onClick={this.onRawQueryClicked}>
              <label className="gf-form-label query-keyword">
                Raw query
                <Icon
                  name={displaRawQuery ? 'angle-down' : 'angle-right'}
                  ng-show="ctrl.showHelp"
                  style={{ marginTop: '3px' }}
                />
              </label>
            </div>
          )}

          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
        {rawQuery && displaRawQuery && (
          <div className="gf-form">
            <pre className="gf-form-pre">{rawQuery}</pre>
          </div>
        )}

        {displayHelp && (
          <div className="gf-form grafana-info-box alert-info">
            <div>
              <h5>Alias Patterns</h5>Format the legend keys any way you want by using alias patterns. Format the legend
              keys any way you want by using alias patterns.
              <br /> <br />
              Example:
              <code>{`${'{{metricDescriptor.name}} - {{metricDescriptor.label.instance_name}}'}`}</code>
              <br />
              Result: &nbsp;&nbsp;<code>cpu/usage_time - server1-europe-west-1</code>
              <br />
              <br />
              <strong>Patterns</strong>
              <br />
              <ul>
                <li>
                  <code>{`${'{{metricDescriptor.type}}'}`}</code> = metric type e.g.
                  compute.googleapis.com/instance/cpu/usage_time
                </li>
                <li>
                  <code>{`${'{{metricDescriptor.name}}'}`}</code> = name part of metric e.g. instance/cpu/usage_time
                </li>
                <li>
                  <code>{`${'{{metricDescriptor.service}}'}`}</code> = service part of metric e.g. compute
                </li>
                <li>
                  <code>{`${'{{metricDescriptor.label.label_name}}'}`}</code> = Metric label metadata e.g.
                  metricDescriptor.label.instance_name
                </li>
                <li>
                  <code>{`${'{{resource.label.label_name}}'}`}</code> = Resource label metadata e.g. resource.label.zone
                </li>
                <li>
                  <code>{`${'{{metadata.system_labels.name}}'}`}</code> = Meta data system labels e.g.
                  metadata.system_labels.name. For this to work, the needs to be included in the group by
                </li>
                <li>
                  <code>{`${'{{metadata.user_labels.name}}'}`}</code> = Meta data user labels e.g.
                  metadata.user_labels.name. For this to work, the needs to be included in the group by
                </li>
                <li>
                  <code>{`${'{{bucket}}'}`}</code> = bucket boundary for distribution metrics when using a heatmap in
                  Grafana
                </li>
                <li>
                  <code>{`${'{{project}}'}`}</code> = The project name that was specified in the query editor
                </li>
                <li>
                  <code>{`${'{{service}}'}`}</code> = The service id that was specified in the SLO query editor
                </li>
                <li>
                  <code>{`${'{{slo}}'}`}</code> = The SLO id that was specified in the SLO query editor
                </li>
                <li>
                  <code>{`${'{{selector}}'}`}</code> = The Selector function that was specified in the SLO query editor
                </li>
              </ul>
            </div>
          </div>
        )}

        {lastQueryError && (
          <div className="gf-form">
            <pre className="gf-form-pre alert alert-error">{lastQueryError}</pre>
          </div>
        )}
      </>
    );
  }
}
