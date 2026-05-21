import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { GrafanaSqlEditorPanel } from './GrafanaSqlEditorPanel';
import { GrafanaSqlLeftPanel } from './GrafanaSqlLeftPanel';
import { parseGrafanaSql } from './grafanaSqlParser';

export const GRAFANA_SQL_DEFAULT_QUERY = `WITH high_latency_requests AS (
  SELECT
    *
  FROM
    \`prometheus::myPromDS\`.\`server_request_http_latency_ms\`
  WHERE
    value > 3000
),
warnLogs AS (
  SELECT
    *
  FROM
    \`loki\`.\`myLokiDS\`
  WHERE
    serviceName = "my-service"
    AND level = "warn"
)
SELECT
  *
FROM
  warnLogs
  JOIN high_latency_requests ON warnLogs.traceId = high_latency_requests.traceId`;

interface Props {
  onBack: () => void;
}

export function GrafanaSqlMode({ onBack }: Props) {
  const styles = useStyles2(getStyles);
  const [sql, setSql] = useState(GRAFANA_SQL_DEFAULT_QUERY);
  const structure = useMemo(() => parseGrafanaSql(sql), [sql]);

  return (
    <div className={styles.root}>
      <div className={styles.left}>
        <GrafanaSqlLeftPanel structure={structure} />
      </div>
      <div className={styles.right}>
        <GrafanaSqlEditorPanel sql={sql} onChange={setSql} onBack={onBack} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'grid',
      gridTemplateColumns: '330px 1fr',
      height: '100%',
      overflow: 'hidden',
      gap: 12,
      padding: 12,
    }),
    left: css({
      overflow: 'hidden',
    }),
    right: css({
      overflow: 'hidden',
    }),
  };
}
