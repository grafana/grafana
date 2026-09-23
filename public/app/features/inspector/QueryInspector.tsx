import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { LoadingState, type DataFrame, type GrafanaTheme2, type PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, ClipboardButton, JSONFormatter, LoadingPlaceholder, Space, Stack, useStyles2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';

import { getPanelInspectorStyles2 } from './styles';

interface ExecutedQueryInfo {
  refId: string;
  query: string;
  frames: number;
  rows: number;
}

interface Props {
  instanceId?: string; // Must match the prefix of the requestId of the query being inspected. For updating only one instance of the inspector in case of multiple instances, ie Explore split view
  data: PanelData;
  onRefreshQuery: () => void;
}

/**
 * Find the list of executed queries
 */
function getExecutedQueries(frames: DataFrame[] | undefined): ExecutedQueryInfo[] {
  const executedQueries: ExecutedQueryInfo[] = [];

  if (frames?.length) {
    let last: ExecutedQueryInfo | undefined = undefined;

    frames.forEach((frame) => {
      const query = frame.meta?.executedQueryString;

      if (query) {
        const refId = frame.refId || '?';

        if (last?.refId === refId) {
          last.frames++;
          last.rows += frame.length;
        } else {
          last = {
            refId,
            frames: 0,
            rows: frame.length,
            query,
          };
          executedQueries.push(last);
        }
      }
    });
  }

  return executedQueries;
}

/**
 * Strip the transport details off a response so only the request and payload are shown.
 * Returns undefined for responses that opted out of the inspector.
 */
function normalizeResponse(response: any): {} | undefined {
  // ignore silent requests
  if (response.config?.hideFromInspector) {
    return undefined;
  }

  response = { ...response }; // clone - dont modify the response

  if (response.headers) {
    delete response.headers;
  }

  if (response.config) {
    response.request = response.config;

    delete response.config;
    delete response.request.transformRequest;
    delete response.request.transformResponse;
    delete response.request.paramSerializer;
    delete response.request.jsonpCallbackParam;
    delete response.request.headers;
    delete response.request.requestId;
    delete response.request.inspect;
    delete response.request.retry;
    delete response.request.timeout;
  }

  if (response.data) {
    response.response = response.data;

    delete response.config;
    delete response.data;
    delete response.status;
    delete response.statusText;
    delete response.ok;
    delete response.url;
    delete response.redirected;
    delete response.type;
    delete response.$$config;
  }

  return response;
}

const getExecutedQueryStyles = (theme: GrafanaTheme2) => ({
  refId: css({
    fontWeight: theme.v1.typography.weight.semibold,
    color: theme.v1.colors.textBlue,
    marginRight: '8px',
  }),
});

function ExecutedQueries({ queries }: { queries: ExecutedQueryInfo[] }) {
  const styles = useStyles2(getExecutedQueryStyles);

  if (!queries.length) {
    return null;
  }

  return (
    <div>
      {queries.map((info) => {
        return (
          <Stack key={info.refId} gap={1} direction="column">
            <div>
              <span className={styles.refId}>{info.refId}:</span>
              {info.frames > 1 && (
                <span>
                  <Trans
                    i18nKey="inspector.query-inspector.count-frames"
                    count={info.frames}
                    tOptions={{
                      defaultValue_one: '{{count}} frames, ',
                      defaultValue_other: '{{count}} frames, ',
                    }}
                  >
                    {'{{count}}'} frames,{' '}
                  </Trans>
                </span>
              )}
              <span>
                <Trans
                  i18nKey="inspector.query-inspector.count-rows"
                  count={info.rows}
                  tOptions={{
                    defaultValue_one: '{{count}} rows',
                    defaultValue_other: '{{count}} rows',
                  }}
                >
                  {'{{count}}'} rows
                </Trans>
              </span>
            </div>
            <pre>{info.query}</pre>
          </Stack>
        );
      })}
    </div>
  );
}

export function QueryInspector({ instanceId, data, onRefreshQuery }: Props) {
  const styles = useStyles2(getPanelInspectorStyles2);
  const [allNodesExpanded, setAllNodesExpanded] = useState<boolean | null>(null);
  const [response, setResponse] = useState<{}>({});
  // Only read when copying to the clipboard, so it must not drive a render.
  const formattedJson = useRef<{} | undefined>(undefined);

  useEffect(() => {
    const subscription = backendSrv.getInspectorStream().subscribe({
      next: (event) => {
        if (instanceId && event?.requestId && !event.requestId.startsWith(instanceId)) {
          return;
        }

        const normalized = normalizeResponse(event.response);
        if (normalized) {
          setResponse(normalized);
        }
      },
    });

    return () => subscription.unsubscribe();
  }, [instanceId]);

  const executedQueries = getExecutedQueries(data.series);
  const haveData = Object.keys(response).length > 0;
  const isLoading = data.state === LoadingState.Loading;
  // 3 is default, ie when state is null
  const openNodes = allNodesExpanded === null ? 3 : allNodesExpanded ? 20 : 1;

  return (
    <div className={styles.wrap}>
      <div data-testid={selectors.components.PanelInspector.Query.content}>
        <h3 className={styles.heading}>
          <Trans i18nKey="inspector.query-inspector.query-inspector">Query inspector</Trans>
        </h3>
        <p className="small muted">
          <Trans i18nKey="inspector.query.description">
            Query inspector allows you to view raw request and response. To collect this data Grafana needs to issue a
            new query. Click refresh button below to trigger a new query.
          </Trans>
        </p>
      </div>
      <ExecutedQueries queries={executedQueries} />
      <Stack direction={'row'} gap={2} justifyContent={'flex-start'} wrap>
        <Button
          icon="sync"
          onClick={onRefreshQuery}
          data-testid={selectors.components.PanelInspector.Query.refreshButton}
        >
          <Trans i18nKey="inspector.query.refresh">Refresh</Trans>
        </Button>

        {haveData && (
          <Button
            icon={allNodesExpanded ? 'minus' : 'plus'}
            variant="secondary"
            onClick={() => setAllNodesExpanded((prev) => !prev)}
          >
            {allNodesExpanded ? (
              <Trans i18nKey="inspector.query.collapse-all">Collapse all</Trans>
            ) : (
              <Trans i18nKey="inspector.query.expand-all">Expand all</Trans>
            )}
          </Button>
        )}

        {haveData && (
          <ClipboardButton
            getText={() => JSON.stringify(formattedJson.current, null, 2)}
            icon="copy"
            variant="secondary"
          >
            <Trans i18nKey="inspector.query.copy-to-clipboard">Copy to clipboard</Trans>
          </ClipboardButton>
        )}
      </Stack>
      <Space v={2} />
      <div className={styles.content}>
        {isLoading && (
          <LoadingPlaceholder
            text={t('inspector.query-inspector.text-loading-query-inspector', 'Loading query inspector...')}
          />
        )}
        {!isLoading && haveData && (
          <JSONFormatter
            json={response}
            open={openNodes}
            onDidRender={(rendered) => {
              formattedJson.current = rendered;
            }}
          />
        )}
        {!isLoading && !haveData && (
          <p className="muted">
            <Trans i18nKey="inspector.query.no-data">No request and response collected yet. Hit refresh button</Trans>
          </p>
        )}
      </div>
    </div>
  );
}
