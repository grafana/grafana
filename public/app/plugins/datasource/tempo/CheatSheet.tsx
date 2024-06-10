import React from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { TextLink } from '@grafana/ui';

export default function CheatSheet() {
  reportInteraction('grafana_traces_cheatsheet_clicked', {
    datasourceType: 'tempo',
    grafana_version: config.buildInfo.version,
  });

  return (
    <>
      <h2>Tempo Cheat Sheet</h2>
      <p>
        <TextLink href={'https://grafana.com/docs/tempo/latest/'} external={true}>
          Grafana Tempo
        </TextLink>{' '}
        is an open source, easy-to-use, and high-volume distributed tracing backend.
      </p>
      <p>
        Tempo implements{' '}
        <TextLink href={'https://grafana.com/docs/tempo/latest/traceql'} external={true}>
          TraceQL
        </TextLink>
        , a traces-first query language inspired by LogQL and PromQL. This query language allows users to precisely and
        easily select spans and jump directly to the spans fulfilling the specified conditions.
      </p>
      <p>
        You can compose TraceQL queries using either the Search tab (the TraceQL query builder) or the TraceQL tab (the
        TraceQL query editor). Both of these methods let you build queries and drill-down into result sets. (
        <TextLink href={'https://grafana.com/docs/grafana/latest/datasources/tempo/query-editor/'} external={true}>
          Learn more
        </TextLink>
        )
      </p>
    </>
  );
}
