import * as z from 'zod/mini';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type AlertRuleSearchHit, alertRuleSearchHitSchema } from '../../gma-rule-list/alert-rules/alertRuleSearchHit';
import {
  type RecordingRuleSearchHit,
  recordingRuleSearchHitSchema,
} from '../../gma-rule-list/recording-rules/recordingRuleSearchHit';

import { HOME_RULE_LIMIT } from './grafanaRulesSummary';

// The backend clamps larger pages, so this is a request, not a promise.
const PAGE_SIZE = 500;

const ALERT_FIELDS = [
  'title',
  'folder',
  'paused',
  'state',
  'health',
  'lastError',
  'labels',
  'totalsHealthy',
  'totalsFiring',
  'totalsPending',
  'totalsRecovering',
  'totalsNoData',
  'totalsError',
];
const RECORDING_FIELDS = ['title', 'folder', 'paused', 'health', 'lastError'];

export interface HomeRuleHits {
  alert: AlertRuleSearchHit[];
  recording: RecordingRuleSearchHit[];
  /** The stack has more rules than were read. */
  hasMore: boolean;
}

function body(fields: string[], continueToken?: string) {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    fields,
    sort: [{ field: 'title', direction: 'asc' as const }],
    limit: PAGE_SIZE,
    ...(continueToken ? { continue: continueToken } : {}),
  };
}

interface Page<Hit> {
  hits: Hit[];
  continueToken?: string;
}

/**
 * Sends one search and parses its hits. The rule list's own page helper also looks up sequence membership
 * for every rule, which this page does not show.
 */
async function fetchPage<Hit>(
  request: PromiseLike<{ data?: unknown; error?: unknown }>,
  itemSchema: z.ZodMiniType<Hit>
): Promise<{ error?: unknown; data?: Page<Hit> }> {
  const response = await request;
  if (response.error) {
    return { error: response.error };
  }
  const parsed = z
    .object({ items: z.array(itemSchema), metadata: z.object({ continue: z.optional(z.string()) }) })
    .safeParse(response.data);
  if (!parsed.success) {
    return { error: { message: parsed.error.message } };
  }
  return { data: { hits: parsed.data.items, continueToken: parsed.data.metadata.continue } };
}

/**
 * Reads pages of one kind of rule until there are no more or `cap` is reached. No filter: the page
 * summarizes every rule. The search has no aggregate, so the summary is built from the rules themselves.
 */
async function readAll<Hit>(
  fetchPage: (continueToken?: string) => Promise<{ error?: unknown; data?: { hits: Hit[]; continueToken?: string } }>,
  cap: number
): Promise<{ hits: Hit[]; hasMore: boolean } | { error: unknown }> {
  const hits: Hit[] = [];
  let token: string | undefined;
  do {
    const page = await fetchPage(token);
    if (page.error || !page.data) {
      return { error: page.error };
    }
    hits.push(...page.data.hits);
    token = page.data.continueToken;
  } while (token && hits.length < cap);

  return { hits: hits.slice(0, cap), hasMore: hits.length > cap || Boolean(token) };
}

export const homeRuleSearchAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    getHomeRuleHits: build.query<HomeRuleHits, void>({
      queryFn: async (_arg, { dispatch }) => {
        const alert = await readAll<AlertRuleSearchHit>(
          (token) =>
            fetchPage(
              dispatch(
                generatedAPI.endpoints.listAlertRuleSearchRulesV0Alpha1.initiate(
                  { listAlertRuleSearchRulesV0Alpha1RequestBody: body(ALERT_FIELDS, token) },
                  { subscribe: false, forceRefetch: true }
                )
              ),
              alertRuleSearchHitSchema
            ),
          HOME_RULE_LIMIT
        );
        if ('error' in alert) {
          return { error: alert.error };
        }

        // The cap covers alert and recording rules together, as the Prometheus-style rules API did.
        const room = HOME_RULE_LIMIT - alert.hits.length;
        const recording = await readAll<RecordingRuleSearchHit>(
          (token) =>
            fetchPage(
              dispatch(
                generatedAPI.endpoints.listRecordingRuleSearchRulesV0Alpha1.initiate(
                  { listRecordingRuleSearchRulesV0Alpha1RequestBody: body(RECORDING_FIELDS, token) },
                  { subscribe: false, forceRefetch: true }
                )
              ),
              recordingRuleSearchHitSchema
            ),
          // Even with no room, one page says whether recording rules exist that were left out.
          Math.max(room, 0)
        );
        if ('error' in recording) {
          return { error: recording.error };
        }

        return {
          data: {
            alert: alert.hits,
            recording: recording.hits,
            hasMore: alert.hasMore || recording.hasMore || (room <= 0 && recording.hits.length > 0),
          },
        };
      },
      providesTags: ['AlertRule', 'RecordingRule'],
    }),
  }),
});
