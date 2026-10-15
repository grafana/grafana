import { css } from '@emotion/css';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { Badge, Box, Stack, Text, useStyles2 } from '@grafana/ui';

// Matches the datasource UID the backend reserves for server-side expressions.
const EXPRESSION_DATASOURCE_UID = '__expr__';

type DeletedRuleExpression = AlertRule['spec']['expressions'][string] | RecordingRule['spec']['expressions'][string];

interface DeletedRuleExpressionsProps {
  expressions: Record<string, DeletedRuleExpression>;
}

export function DeletedRuleExpressions({ expressions }: DeletedRuleExpressionsProps) {
  const entries = Object.entries(expressions);
  if (entries.length === 0) {
    return <Text>-</Text>;
  }
  return (
    <Stack direction="column" gap={1}>
      {entries.map(([refId, expression]) => (
        <ExpressionEntry key={refId} refId={refId} expression={expression} />
      ))}
    </Stack>
  );
}

function ExpressionEntry({ refId, expression }: { refId: string; expression: DeletedRuleExpression }) {
  const isServerSideExpression = expression.datasourceUID === EXPRESSION_DATASOURCE_UID;
  return (
    <Box backgroundColor="secondary" borderRadius="default" padding={1}>
      <Stack direction="column" gap={0.5}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Text weight="bold">{refId}</Text>
          {expression.source && (
            <Badge text={t('alerting.deleted-rules.review.expression-source', 'Source')} color="blue" />
          )}
        </Stack>
        {isServerSideExpression ? (
          <ServerSideExpressionDetails model={expression.model} />
        ) : (
          <QueryDetails expression={expression} />
        )}
      </Stack>
    </Box>
  );
}

function QueryDetails({ expression }: { expression: DeletedRuleExpression }) {
  const { settings } = useDataSourceInstanceSettings(expression.datasourceUID);
  const queryText = getQueryText(expression.model);

  return (
    <>
      <Text variant="bodySmall" color="secondary">
        {t('alerting.deleted-rules.review.query-data-source', 'Data source: {{name}}', {
          name: settings?.name ?? expression.datasourceUID ?? t('alerting.deleted-rules.unknown', 'Unknown'),
        })}
      </Text>
      <Code text={queryText} />
    </>
  );
}

function ServerSideExpressionDetails({ model }: { model: Record<string, unknown> }) {
  const type = typeof model.type === 'string' ? model.type : undefined;
  const typeLabel = getExpressionTypeLabel(type);
  const expressionText = typeof model.expression === 'string' ? model.expression : undefined;
  const reducer = typeof model.reducer === 'string' ? model.reducer : undefined;

  return (
    <>
      <Text variant="bodySmall" color="secondary">
        {t('alerting.deleted-rules.review.expression-type', 'Expression type: {{type}}', {
          type: typeLabel ?? t('alerting.deleted-rules.unknown', 'Unknown'),
        })}
      </Text>
      {reducer && (
        <Text variant="bodySmall" color="secondary">
          {t('alerting.deleted-rules.review.expression-reducer', 'Function: {{reducer}}', { reducer })}
        </Text>
      )}
      {expressionText ? <Code text={expressionText} /> : <Code text={stringifyModel(model)} />}
    </>
  );
}

function Code({ text }: { text: string }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.code}>
      <Text variant="code">{text}</Text>
    </div>
  );
}

const getStyles = () => ({
  code: css({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }),
});

// The query text lives under a different key per data source type.
const QUERY_TEXT_KEYS = ['expr', 'query', 'rawSql', 'target', 'queryText', 'rawQuery'];

function getQueryText(model: Record<string, unknown>): string {
  for (const key of QUERY_TEXT_KEYS) {
    const value = model[key];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return stringifyModel(model);
}

// Fields every query carries that say nothing about what it asks for.
const BOILERPLATE_KEYS = ['refId', 'datasource', 'intervalMs', 'maxDataPoints', 'hide'];

function stringifyModel(model: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(model).filter(([key]) => !BOILERPLATE_KEYS.includes(key))));
}

function getExpressionTypeLabel(type: string | undefined): string | undefined {
  switch (type) {
    case 'math':
      return t('alerting.deleted-rules.review.expression-type-math', 'Math');
    case 'reduce':
      return t('alerting.deleted-rules.review.expression-type-reduce', 'Reduce');
    case 'resample':
      return t('alerting.deleted-rules.review.expression-type-resample', 'Resample');
    case 'threshold':
      return t('alerting.deleted-rules.review.expression-type-threshold', 'Threshold');
    case 'classic_conditions':
      return t('alerting.deleted-rules.review.expression-type-classic', 'Classic condition (legacy)');
    case 'sql':
      return t('alerting.deleted-rules.review.expression-type-sql', 'SQL');
    default:
      return type;
  }
}
