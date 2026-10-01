import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { parseInsightAnswer } from './answer';
import { type InsightResult, type InsightShare, type InsightSnapshot } from './types';

const SHARED_ANSWER_TAG = 'grafana-insight-answer';
const SHARED_ANSWER_VERSION = 1;
/** The annotation data column is TEXT on MySQL, which holds 64 KB. */
const MAX_SHARED_BYTES = 60_000;
/** Newest first; enough for every insight on a dashboard to have a few shares. */
const MAX_SHARED_ANSWERS = 200;

const dashboardTag = (uid: string) => `insight-dashboard:${uid}`;
const insightTag = (id: string) => `insight:${id}`;

interface StoredSharedAnswer {
  version: typeof SHARED_ANSWER_VERSION;
  insightId: string;
  /** Without `share`: who shared it comes from the annotation itself. */
  result: InsightResult;
}

interface SharedAnswerItem {
  id: number;
  time: number;
  login?: string;
  avatarUrl?: string;
  data?: unknown;
}

/** Editors share; everyone who can read the dashboard's organization annotations sees the answer. */
export function canShareInsightAnswers(dashboard: DashboardSceneLike): boolean {
  return Boolean(dashboard.state.uid && dashboard.state.meta.canEdit) && contextSrv.hasPermission('annotations:create');
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function withoutFrames(snapshot: InsightSnapshot): InsightSnapshot {
  const strip = <T extends { frames: unknown[] }>(panel: T): T => ({ ...panel, frames: [] });
  return {
    ...snapshot,
    panels: snapshot.panels.map(strip),
    previousPeriod: snapshot.previousPeriod && {
      ...snapshot.previousPeriod,
      panels: snapshot.previousPeriod.panels.map(strip),
    },
    breakdown: snapshot.breakdown && {
      ...snapshot.breakdown,
      values: snapshot.breakdown.values.map((value) => ({
        ...value,
        panels: value.panels.map(strip),
        previousPeriod: value.previousPeriod?.map(strip),
      })),
    },
  };
}

/**
 * Stores the answer as an organization annotation tagged with the dashboard and the insight, so it does not
 * show on the dashboard's own annotation layer. The captured values are left out when they do not fit.
 */
export async function shareInsightAnswer(dashboardUid: string, insightId: string, result: InsightResult) {
  const unshared: InsightResult = { ...result, share: undefined };
  let stored: StoredSharedAnswer = { version: SHARED_ANSWER_VERSION, insightId, result: unshared };
  if (byteLength(JSON.stringify(stored)) > MAX_SHARED_BYTES) {
    stored = { ...stored, result: { ...unshared, snapshot: withoutFrames(unshared.snapshot), framesOmitted: true } };
  }
  if (byteLength(JSON.stringify(stored)) > MAX_SHARED_BYTES) {
    throw new Error(t('dashboard.insights.share.too-large', 'This answer is too large to share.'));
  }

  const sharedAt = Date.now();
  const response = await getBackendSrv().post<{ id: number }>(
    '/api/annotations',
    {
      time: sharedAt,
      text: t('dashboard.insights.share.annotation-text', 'Shared insight: {{headline}}', {
        headline: result.content.headline,
      }),
      tags: [SHARED_ANSWER_TAG, dashboardTag(dashboardUid), insightTag(insightId)],
      data: stored,
    },
    { showSuccessAlert: false }
  );
  const shared: InsightShare = {
    annotationId: response.id,
    login: contextSrv.user.login,
    avatarUrl: contextSrv.user.gravatarUrl,
    sharedAt: new Date(sharedAt).toISOString(),
  };
  return shared;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSnapshot(value: unknown): value is InsightSnapshot {
  return (
    isRecord(value) &&
    typeof value.question === 'string' &&
    typeof value.dashboardUid === 'string' &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    isRecord(value.variables) &&
    Array.isArray(value.panels) &&
    value.panels.every(
      (panel) =>
        isRecord(panel) &&
        typeof panel.key === 'string' &&
        typeof panel.title === 'string' &&
        Array.isArray(panel.frames)
    )
  );
}

/** Another editor wrote it, so it is validated like model output before it is rendered. */
function parseSharedAnswer(item: SharedAnswerItem, dashboardUid: string): [string, InsightResult] | undefined {
  const { data } = item;
  if (!isRecord(data) || data.version !== SHARED_ANSWER_VERSION || typeof data.insightId !== 'string') {
    return undefined;
  }
  const result = data.result;
  if (!isRecord(result)) {
    return undefined;
  }
  const { snapshot, completedAt, sourceLocation, framesOmitted } = result;
  if (!isSnapshot(snapshot) || snapshot.dashboardUid !== dashboardUid || typeof completedAt !== 'string') {
    return undefined;
  }
  try {
    const content = parseInsightAnswer(JSON.stringify(result.content), snapshot);
    return [
      data.insightId,
      {
        content,
        snapshot,
        completedAt,
        sourceLocation: typeof sourceLocation === 'string' ? sourceLocation : window.location.href,
        framesOmitted: framesOmitted === true,
        share: {
          annotationId: item.id,
          login: item.login ?? '',
          avatarUrl: item.avatarUrl,
          sharedAt: new Date(item.time).toISOString(),
        },
      },
    ];
  } catch {
    return undefined;
  }
}

/** The latest shared answer per insight on the dashboard, keyed by insight id. */
export async function loadSharedInsightAnswers(dashboardUid: string): Promise<Map<string, InsightResult>> {
  const items = await getBackendSrv().get<SharedAnswerItem[]>(
    '/api/annotations',
    {
      tags: [SHARED_ANSWER_TAG, dashboardTag(dashboardUid)],
      matchAny: false,
      type: 'annotation',
      limit: MAX_SHARED_ANSWERS,
    },
    undefined,
    { showErrorAlert: false }
  );
  const answers = new Map<string, InsightResult>();
  for (const item of [...items].sort((a, b) => b.time - a.time)) {
    const parsed = parseSharedAnswer(item, dashboardUid);
    if (parsed && !answers.has(parsed[0])) {
      answers.set(...parsed);
    }
  }
  return answers;
}
