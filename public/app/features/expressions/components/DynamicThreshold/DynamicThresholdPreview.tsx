import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type DataFrame, generateUUID, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { dataSource } from '../../ExpressionDatasource';
import { isExpressionQuery } from '../../guards';
import { type DynamicThresholdPolicyV1 } from '../../types';
import { interpolateSourceQueries } from '../../utils/interpolateSourceQueries';

import { getSourceQueryKey, useSourceQueryTimeRange } from './utils';

const MAX_PREVIEW_ROWS = 50;

interface Props {
  queries: AlertQuery[];
  policy: DynamicThresholdPolicyV1;
  previewSql: string;
}

type PreviewResult =
  | { key: string; frame: DataFrame; error?: undefined }
  | { key: string; error: string; frame?: undefined };

export function DynamicThresholdPreview({ queries, policy, previewSql }: Props) {
  const styles = useStyles2(getStyles);
  const sourceQuery = queries.find((query) => query.refId === policy.inputRefId && !isExpressionQuery(query.model));
  const timeRange = useSourceQueryTimeRange(sourceQuery);
  const requestKey = sourceQuery ? `${getSourceQueryKey(policy.inputRefId, sourceQuery)}\0${previewSql}` : '';
  const [result, setResult] = useState<PreviewResult>({ key: '', error: '' });

  useEffect(() => {
    if (!sourceQuery || !requestKey) {
      return;
    }

    let cancelled = false;
    const refId = `dynamic-threshold-preview-${generateUUID()}`;
    interpolateSourceQueries([sourceQuery.model], {})
      .then((interpolatedQueries) =>
        cancelled
          ? undefined
          : dataSource.runMetaSQLExprQuery({ rawSql: previewSql, refId }, timeRange, interpolatedQueries)
      )
      .then((frame) => !cancelled && frame && setResult({ key: requestKey, frame }))
      .catch((error) => !cancelled && setResult({ key: requestKey, error: getMessageFromError(error) }));

    return () => {
      cancelled = true;
      backendSrv.resolveCancelerIfExists(refId);
    };
  }, [previewSql, requestKey, sourceQuery, timeRange]);

  // A response is only shown for the exact request it answered; anything else counts as loading.
  const current = result.key === requestKey ? result : undefined;
  const isRange = previewHasRange(current?.frame);

  if (!sourceQuery) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Text element="h4" variant="h6">
        <Trans i18nKey="expressions.dynamic-threshold.preview.title">Policy preview</Trans>
      </Text>
      {!current && (
        <Stack direction="row" gap={1} alignItems="center">
          <Spinner size="sm" />
          <Trans i18nKey="expressions.dynamic-threshold.preview.loading">Loading preview</Trans>
        </Stack>
      )}
      {current?.error !== undefined && (
        <Alert
          title={t('expressions.dynamic-threshold.preview.error', 'Unable to load policy preview')}
          severity="error"
        >
          {current.error}
        </Alert>
      )}
      {current?.frame && current.frame.length === 0 && (
        <Text color="secondary">
          <Trans i18nKey="expressions.dynamic-threshold.preview.empty">The input query returned no data.</Trans>
        </Text>
      )}
      {current?.frame && current.frame.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                {policy.labelColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
                <th>{t('expressions.dynamic-threshold.preview.current-value', 'Current value')}</th>
                <th>
                  {isRange
                    ? t('expressions.dynamic-threshold.preview.matched-range', 'Matched range')
                    : t('expressions.dynamic-threshold.preview.matched-threshold', 'Matched threshold')}
                </th>
                <th>{t('expressions.dynamic-threshold.preview.condition', 'Condition')}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(current.frame.length, MAX_PREVIEW_ROWS) }, (_, row) => (
                <PreviewRow key={row} frame={current.frame} row={row} labelColumns={policy.labelColumns} />
              ))}
            </tbody>
          </table>
          {current.frame.length > MAX_PREVIEW_ROWS && (
            <Text color="secondary">
              <Trans
                i18nKey="expressions.dynamic-threshold.preview.truncated"
                values={{ shown: MAX_PREVIEW_ROWS, total: current.frame.length }}
              >
                Showing {'{{shown}}'} of {'{{total}}'} rows
              </Trans>
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}

function PreviewRow({ frame, row, labelColumns }: { frame: DataFrame; row: number; labelColumns: string[] }) {
  const value = (name: string) => frame.fields.find((field) => field.name === name)?.values[row];
  const lower = value('matched_threshold_lower');
  const upper = value('matched_threshold_upper');
  const threshold =
    lower !== undefined || upper !== undefined ? `${lower} – ${upper}` : formatCell(value('matched_threshold'));
  const condition = value('condition_result');

  return (
    <tr>
      {labelColumns.map((column) => (
        <td key={column}>{formatCell(value(column))}</td>
      ))}
      <td>{formatCell(value('current_value'))}</td>
      <td>{threshold}</td>
      <td>
        {condition === null || condition === undefined
          ? t('expressions.dynamic-threshold.preview.condition-no-value', 'No value')
          : Number(condition) === 0
            ? t('expressions.dynamic-threshold.preview.condition-false', 'False')
            : t('expressions.dynamic-threshold.preview.condition-true', 'True')}
      </td>
    </tr>
  );
}

function previewHasRange(frame: DataFrame | undefined): boolean {
  return Boolean(frame?.fields.some((field) => field.name === 'matched_threshold_lower'));
}

function formatCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    'td, th': {
      padding: theme.spacing(0.5, 1),
      textAlign: 'left',
    },
    tr: {
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
  }),
});
