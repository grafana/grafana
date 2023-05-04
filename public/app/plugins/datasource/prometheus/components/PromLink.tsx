import { map } from 'lodash';
import React, { useEffect, useState, memo } from 'react';

import { DataQueryRequest, PanelData, ScopedVars, textUtil, rangeUtil } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { getPrometheusTime } from '../language_utils';
import { PromQuery } from '../types';

interface Props {
  datasource: PrometheusDatasource;
  query: PromQuery;
  panelData?: PanelData;
}

const PromLink = ({ panelData, query, datasource }: Props) => {
  const [href, setHref] = useState('');

  useEffect(() => {
    if (panelData) {
      const getExternalLink = () => {
        if (!panelData.request) {
          return '';
        }

        const {
          request: { range, interval, scopedVars },
        } = panelData;

        const start = getPrometheusTime(range.from, false);
        const end = getPrometheusTime(range.to, true);
        const rangeDiff = Math.ceil(end - start);
        const endTime = range.to.utc().format('YYYY-MM-DD HH:mm');

        const enrichedScopedVars: ScopedVars = {
          ...scopedVars,
          // As we support $__rate_interval variable in min step, we need add it to scopedVars
          ...datasource.getRateIntervalScopedVariable(
            rangeUtil.intervalToSeconds(interval),
            rangeUtil.intervalToSeconds(datasource.interval)
          ),
        };

        const options = {
          interval,
          scopedVars: enrichedScopedVars,
        } as DataQueryRequest<PromQuery>;

        const customQueryParameters: { [key: string]: string } = {};
        if (datasource.customQueryParameters) {
          for (const [k, v] of datasource.customQueryParameters) {
            customQueryParameters[k] = v;
          }
        }

        const queryOptions = datasource.createQuery(query, options, start, end);

        const expr = {
          ...customQueryParameters,
          'g0.expr': queryOptions.expr,
          'g0.range_input': rangeDiff + 's',
          'g0.end_input': endTime,
          'g0.step_input': queryOptions.step,
          'g0.tab': 0,
        };

        const args = map(expr, (v: string, k: string) => {
          return k + '=' + encodeURIComponent(v);
        }).join('&');
        return `${datasource.directUrl}/graph?${args}`;
      };

      setHref(getExternalLink());
    }
  }, [datasource, panelData, query]);

  return (
    <a href={textUtil.sanitizeUrl(href)} target="_blank" rel="noopener noreferrer">
      Prometheus
    </a>
  );
};

export default memo(PromLink);
