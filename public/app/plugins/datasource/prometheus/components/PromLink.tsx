import _ from 'lodash';
import React, { Component } from 'react';

import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';
import { DataQueryRequest, PanelData } from '@grafana/data';

interface Props {
  datasource: PrometheusDatasource;
  query: PromQuery;
  panelData?: PanelData;
}

interface State {
  href: string;
}

export default class PromLink extends Component<Props, State> {
  state: State = { href: '' };

  async componentDidUpdate(prevProps: Props) {
    const { panelData } = this.props;

    if (panelData && panelData.request && prevProps.panelData !== panelData) {
      const href = await this.getExternalLink(panelData);
      this.setState({ href });
    }
  }

  async getExternalLink(panelData: PanelData): Promise<string> {
    const { query, datasource } = this.props;
    const { request } = panelData;

    if (!request) {
      return '';
    }

    const range = request.range;
    const start = datasource.getPrometheusTime(range.from, false);
    const end = datasource.getPrometheusTime(range.to, true);
    const rangeDiff = Math.ceil(end - start);
    const endTime = range.to.utc().format('YYYY-MM-DD HH:mm');

    const options = {
      interval: request.interval,
    } as DataQueryRequest<PromQuery>;

    const queryOptions = datasource.createQuery(query, options, start, end);
    const expr = {
      'g0.expr': queryOptions.expr,
      'g0.range_input': rangeDiff + 's',
      'g0.end_input': endTime,
      'g0.step_input': queryOptions.step,
      'g0.tab': 0,
    };

    const args = _.map(expr, (v: string, k: string) => {
      return k + '=' + encodeURIComponent(v);
    }).join('&');
    return `${datasource.directUrl}/graph?${args}`;
  }

  render() {
    const { href } = this.state;

    return (
      <a href={href} target="_blank" rel="noopener">
        Prometheus
      </a>
    );
  }
}
