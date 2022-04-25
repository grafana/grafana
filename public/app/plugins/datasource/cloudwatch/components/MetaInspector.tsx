import { groupBy } from 'lodash';
import React, { useMemo } from 'react';

import { MetadataInspectorProps } from '@grafana/data';

import { CloudWatchDatasource } from '../datasource';
import { CloudWatchQuery, CloudWatchJsonData } from '../types';

export type Props = MetadataInspectorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>;

export function MetaInspector({ data = [] }: Props) {
  const rows = useMemo(() => groupBy(data, 'refId'), [data]);

  return (
    <>
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <th>RefId</th>
            <th>Metric Data Query ID</th>
            <th>Metric Data Query Expression</th>
            <th>Period</th>
            <th />
          </tr>
        </thead>
        {Object.entries(rows).map(([refId, frames], idx) => {
          if (!frames.length) {
            return null;
          }

          const frame = frames[0];
          const custom = frame.meta?.custom;
          if (!custom) {
            return null;
          }

          return (
            <tbody key={idx}>
              <tr>
                <td>{refId}</td>
                <td>{custom.id}</td>
                <td>{frame.meta?.executedQueryString}</td>
                <td>{custom.period}</td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </>
  );
}
