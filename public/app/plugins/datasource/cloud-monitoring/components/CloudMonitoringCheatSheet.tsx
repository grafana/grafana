import { css } from '@emotion/css';
import { PureComponent } from 'react';

import { QueryEditorHelpProps } from '@grafana/data';

import { CloudMonitoringQuery } from '../types/query';

export default class CloudMonitoringCheatSheet extends PureComponent<
  QueryEditorHelpProps<CloudMonitoringQuery>,
  { userExamples: string[] }
> {
  render() {
    return (
      <div>
        <h2>Cloud Monitoring alias patterns</h2>
        <div>
          <p>
            Format the legend keys any way you want by using alias patterns. Format the legend keys any way you want by
            using alias patterns.
          </p>
          Example:
          <code>{`${'{{metric.name}} - {{metric.label.instance_name}}'}`}</code>
          <br />
          Result: &nbsp;&nbsp;<code>cpu/usage_time - server1-europe-west-1</code>
          <br />
          <br />
          <span>Patterns:</span>
          <br />
          <ul
            className={css({
              listStyle: 'none',
            })}
          >
            <li>
              <code>{`${'{{metric.type}}'}`}</code> = metric type e.g. compute.googleapis.com/instance/cpu/usage_time
            </li>
            <li>
              <code>{`${'{{metric.name}}'}`}</code> = name part of metric e.g. instance/cpu/usage_time
            </li>
            <li>
              <code>{`${'{{metric.service}}'}`}</code> = service part of metric e.g. compute
            </li>
            <li>
              <code>{`${'{{metric.label.label_name}}'}`}</code> = Metric label metadata e.g. metric.label.instance_name
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
    );
  }
}
