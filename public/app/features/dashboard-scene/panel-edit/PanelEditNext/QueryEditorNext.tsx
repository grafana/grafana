import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Badge, Button, Card, Grid, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { useQueryEditorState, useQueryEditorActions } from './QueryEditorContext';

export const QueryEditorNext = () => {
  const styles = useStyles2(getStyles);

  // This is just a demo component to show the query editor context
  // TODO:Rip this out first thing when we build this out
  return (
    <div className={styles.container}>
      <Text variant="h3">
        <Trans i18nKey="query-editor-next.title">🚀 Next Generation Query Editor</Trans>
      </Text>
      <Text color="secondary">
        <Trans i18nKey="query-editor-next.description">
          This is a scaffold showing all available context data. Each section uses granular hooks for optimal
          performance.
        </Trans>
      </Text>

      <Grid columns={2} gap={2}>
        <DatasourceInfo />
        <QueriesInfo />
        <DataInfo />
        <ActionsDemo />
      </Grid>
    </div>
  );
};

// Datasource information
function DatasourceInfo() {
  const { dsSettings, panel } = useQueryEditorState();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Icon name="database" />
          <span>
            <Trans i18nKey="query-editor-next.datasource">Datasource</Trans>
          </span>
        </Stack>
      </Card.Heading>
      <Card.Description>
        <Stack direction="column" gap={1}>
          <Row label={t('query-editor-next.name', 'Name')} value={dsSettings?.name ?? 'Not loaded'} />
          <Row label={t('query-editor-next.type', 'Type')} value={dsSettings?.type ?? '—'} />
          <Row label={t('query-editor-next.uid', 'UID')} value={dsSettings?.uid ?? '—'} mono />
          <Row label={t('query-editor-next.panel-key', 'Panel Key')} value={panel.state.key ?? '—'} mono />
        </Stack>
      </Card.Description>
    </Card>
  );
}

// Queries list
function QueriesInfo() {
  const { queries } = useQueryEditorState();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Icon name="document-info" />
          <span>
            <Trans i18nKey="query-editor-next.queries">Queries</Trans>
          </span>
          <Badge text={String(queries.length)} color="blue" />
        </Stack>
      </Card.Heading>
      <Card.Description>
        {queries.length === 0 ? (
          <Text color="secondary">
            <Trans i18nKey="query-editor-next.no-queries-defined">No queries defined</Trans>
          </Text>
        ) : (
          <Stack direction="column" gap={1}>
            {queries.map((query, index) => (
              <Stack key={query.refId} alignItems="center" gap={1}>
                <Badge text={query.refId} color="green" />
                <Text variant="bodySmall" color="secondary">
                  {query.datasource?.type ?? 'inherited'}
                </Text>
                {query.hide && <Badge text={t('query-editor-next.hidden', 'hidden')} color="orange" icon="eye-slash" />}
              </Stack>
            ))}
          </Stack>
        )}
      </Card.Description>
    </Card>
  );
}

// Data results
function DataInfo() {
  const { data, isLoading, error } = useQueryEditorState();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Icon name="chart-line" />
          <span>
            <Trans i18nKey="query-editor-next.data">Data</Trans>
          </span>
          {isLoading && <Spinner size="sm" />}
          {data?.state && <Badge text={data.state} color={data.state === 'Done' ? 'green' : 'blue'} />}
        </Stack>
      </Card.Heading>
      <Card.Description>
        {error ? (
          <Alert severity="error" title={t('query-editor-next.error', 'Error')}>
            {error.message}
          </Alert>
        ) : !data ? (
          <Text color="secondary">
            <Trans i18nKey="query-editor-next.no-data-yet">No data yet</Trans>
          </Text>
        ) : (
          <Stack direction="column" gap={1}>
            <Row label={t('query-editor-next.state', 'State')} value={data.state} />
            <Row label={t('query-editor-next.series', 'Series')} value={String(data.series?.length ?? 0)} />
            <Row
              label={t('query-editor-next.annotations', 'Annotations')}
              value={String(data.annotations?.length ?? 0)}
            />
            {data.series?.[0] && (
              <>
                <Row
                  label={t('query-editor-next.first-series', 'First Series')}
                  value={data.series[0].name ?? data.series[0].refId ?? '—'}
                />
                <Row label={t('query-editor-next.fields', 'Fields')} value={String(data.series[0].fields.length)} />
                <Row label={t('query-editor-next.rows', 'Rows')} value={String(data.series[0].length)} />
              </>
            )}
            {data.timeRange && (
              <Row
                label={t('query-editor-next.time-range', 'Time Range')}
                value={`${data.timeRange.from.format('HH:mm')} - ${data.timeRange.to.format('HH:mm')}`}
              />
            )}
          </Stack>
        )}
      </Card.Description>
    </Card>
  );
}

// Actions demo - stable refs, no re-renders on state change
function ActionsDemo() {
  const { addQuery, runQueries } = useQueryEditorActions();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Icon name="bolt" />
          <span>
            <Trans i18nKey="query-editor-next.actions">Actions</Trans>
          </span>
        </Stack>
      </Card.Heading>
      <Card.Description>
        <Stack direction="column" gap={2}>
          <Text color="secondary">
            <Trans i18nKey="query-editor-next.stable-action-references">
              These buttons use stable action references (no re-renders on data change)
            </Trans>
          </Text>
          <Stack gap={1}>
            <Button variant="secondary" size="sm" icon="plus" onClick={() => addQuery()}>
              <Trans i18nKey="query-editor-next.add-query">Add Query</Trans>
            </Button>
            <Button variant="primary" size="sm" icon="sync" onClick={() => runQueries()}>
              <Trans i18nKey="query-editor-next.run-queries">Run Queries</Trans>
            </Button>
          </Stack>
        </Stack>
      </Card.Description>
    </Card>
  );
}

// Helper component for label/value rows
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack justifyContent="space-between" alignItems="center">
      <Text color="secondary" variant="bodySmall">
        {label}
      </Text>
      {mono ? (
        <code>{value}</code>
      ) : (
        <Text variant="bodySmall" weight="medium">
          {value}
        </Text>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(2),
    }),
  };
}
