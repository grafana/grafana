import _ from 'lodash';
import React, { Component } from 'react';

import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

interface Props {
  datasource: PrometheusDatasource;
  query: PromQuery;
}

export default class PromLink extends Component<Props> {
  getExternalLink(): string {
    const { datasource, query } = this.props;
    const range = getTimeSrv().timeRange();

    const rangeDiff = Math.ceil((range.to.valueOf() - range.from.valueOf()) / 1000);
    const endTime = range.to.utc().format('YYYY-MM-DD HH:mm');
    const options = {
      // TODO Should be the dynamically calculated interval from the panel ctrl
      interval: datasource.interval,
    };
    // TODO update expr when template variables change
    const queryOptions = datasource.createQuery(query, options, range.from.valueOf(), range.to.valueOf());
    const expr = {
      'g0.expr': queryOptions.expr,
      'g0.range_input': rangeDiff + 's',
      'g0.end_input': endTime,
      'g0.step_input': queryOptions.step,
      'g0.tab': 0,
    };

    const args = _.map(expr, (v, k) => {
      return k + '=' + encodeURIComponent(v);
    }).join('&');
    return `${datasource.directUrl}/graph?${args}`;
  }

  render() {
    const href = this.getExternalLink();
    return (
      <a href={href} target="_blank">
        <i className="fa fa-share-square-o" /> Prometheus
      </a>
    );
  }
}
