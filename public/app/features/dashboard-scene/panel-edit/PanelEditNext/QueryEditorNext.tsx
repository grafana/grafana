/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, Badge, Button, Card, Grid, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import {
  useDatasourceSettings,
  useError,
  useIsLoading,
  usePanelData,
  usePanel,
  useQueries,
  useQueryEditorActions,
} from './QueryEditorContext';

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
        This is a scaffold showing all available context data. Each section uses granular hooks for optimal performance.
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

// Datasource information - uses useQueryEditorCore
function DatasourceInfo() {
  const dsSettings = useDatasourceSettings();
  const panel = usePanel();

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
          <Row label="Name" value={dsSettings?.name ?? 'Not loaded'} />
          <Row label="Type" value={dsSettings?.type ?? '—'} />
          <Row label="UID" value={dsSettings?.uid ?? '—'} mono />
          <Row label="Panel Key" value={panel.state.key ?? '—'} mono />
        </Stack>
      </Card.Description>
    </Card>
  );
}

// Queries list - uses useQueryEditorQueries
function QueriesInfo() {
  const queries = useQueries();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Icon name="document-info" />
          <span>Queries</span>
          <Badge text={String(queries.length)} color="blue" />
        </Stack>
      </Card.Heading>
      <Card.Description>
        {queries.length === 0 ? (
          <Text color="secondary">No queries defined</Text>
        ) : (
          <Stack direction="column" gap={1}>
            {queries.map((query, index) => (
              <Stack key={query.refId} alignItems="center" gap={1}>
                <Badge text={query.refId} color="green" />
                <Text variant="bodySmall" color="secondary">
                  {query.datasource?.type ?? 'inherited'}
                </Text>
                {query.hide && <Badge text="hidden" color="orange" icon="eye-slash" />}
              </Stack>
            ))}
          </Stack>
        )}
      </Card.Description>
    </Card>
  );
}

// Data results - uses useQueryEditorData
function DataInfo() {
  const data = usePanelData();
  const isLoading = useIsLoading();
  const error = useError();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Icon name="chart-line" />
          <span>Data</span>
          {isLoading && <Spinner size="sm" />}
          {data?.state && <Badge text={data.state} color={data.state === 'Done' ? 'green' : 'blue'} />}
        </Stack>
      </Card.Heading>
      <Card.Description>
        {error ? (
          <Alert severity="error" title="Error">
            {error.message}
          </Alert>
        ) : !data ? (
          <Text color="secondary">No data yet</Text>
        ) : (
          <Stack direction="column" gap={1}>
            <Row label="State" value={data.state} />
            <Row label="Series" value={String(data.series?.length ?? 0)} />
            <Row label="Annotations" value={String(data.annotations?.length ?? 0)} />
            {data.series?.[0] && (
              <>
                <Row label="First Series" value={data.series[0].name ?? data.series[0].refId ?? '—'} />
                <Row label="Fields" value={String(data.series[0].fields.length)} />
                <Row label="Rows" value={String(data.series[0].length)} />
              </>
            )}
            {data.timeRange && (
              <Row
                label="Time Range"
                value={`${data.timeRange.from.format('HH:mm')} - ${data.timeRange.to.format('HH:mm')}`}
              />
            )}
          </Stack>
        )}
      </Card.Description>
    </Card>
  );
}

// Actions demo - uses useQueryEditorActions
function ActionsDemo() {
  const { addQuery, runQueries } = useQueryEditorActions();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Icon name="bolt" />
          <span>Actions</span>
        </Stack>
      </Card.Heading>
      <Card.Description>
        <Stack direction="column" gap={2}>
          <Text color="secondary">These buttons use stable action references (no re-renders on data change)</Text>
          <Stack gap={1}>
            <Button variant="secondary" size="sm" icon="plus" onClick={() => addQuery()}>
              Add Query
            </Button>
            <Button variant="primary" size="sm" icon="sync" onClick={() => runQueries()}>
              Run Queries
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
