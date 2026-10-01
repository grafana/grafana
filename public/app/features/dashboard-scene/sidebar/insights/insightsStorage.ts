import { type SceneObject } from '@grafana/scenes';
import { AnnoKeyInsights, type ObjectMeta } from 'app/features/apiserver/types';

import { type DashboardSceneLike, getDashboardSceneLike } from '../../scene/types/dashboard';

import { type InsightQuestion } from './types';

const INSIGHTS_ANNOTATION_VERSION = 1;

/**
 * Narrow host so Insights modules and the save pipeline share one read/write path without
 * importing DashboardScene (circular dep).
 */
export interface InsightsAnnotationHost {
  state: { meta: { k8s?: Partial<ObjectMeta> } };
  serializer: {
    getK8SMetadata: () => Partial<ObjectMeta> | undefined;
    setK8SAnnotations: (annotations: Record<string, string>) => void;
  };
  setState: (state: { meta: { k8s?: Partial<ObjectMeta> } }) => void;
}

export type InsightsDashboard = DashboardSceneLike & InsightsAnnotationHost;

export function getInsightsDashboard(sceneObject: SceneObject): InsightsDashboard {
  const scene = getDashboardSceneLike(sceneObject);
  if (!isInsightsDashboard(scene)) {
    throw new Error('SceneObject root does not support Insights');
  }
  return scene;
}

function isInsightsDashboard(scene: DashboardSceneLike): scene is InsightsDashboard {
  return 'serializer' in scene;
}

/** meta.k8s is the source of truth in the editor; the serializer holds the loaded value. */
export function getInsightsAnnotation(host: InsightsAnnotationHost): string | undefined {
  const fromMeta = host.state.meta.k8s?.annotations?.[AnnoKeyInsights];
  if (typeof fromMeta === 'string') {
    return fromMeta;
  }
  const fromSerializer = host.serializer.getK8SMetadata()?.annotations?.[AnnoKeyInsights];
  return typeof fromSerializer === 'string' ? fromSerializer : undefined;
}

export function parseInsightQuestions(value: string | undefined): { questions: InsightQuestion[]; invalid: boolean } {
  if (value === undefined) {
    return { questions: [], invalid: false };
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== INSIGHTS_ANNOTATION_VERSION || !Array.isArray(parsed.questions)) {
      return { questions: [], invalid: true };
    }
    const questions: InsightQuestion[] = [];
    for (const item of parsed.questions) {
      if (!isStoredInsightQuestion(item)) {
        return { questions: [], invalid: true };
      }
      questions.push({
        id: item.id,
        question: item.question,
        sourcePanelKeys: [...item.sourcePanelKeys],
        followUps: [...(item.followUps ?? [])],
        ...(item.compareWithPreviousPeriod === true && { compareWithPreviousPeriod: true }),
        ...(item.breakdownVariable ? { breakdownVariable: item.breakdownVariable } : {}),
      });
    }
    return { questions, invalid: false };
  } catch {
    return { questions: [], invalid: true };
  }
}

export function readInsightQuestions(host: InsightsAnnotationHost): { questions: InsightQuestion[]; invalid: boolean } {
  return parseInsightQuestions(getInsightsAnnotation(host));
}

export function serializeInsightQuestions(questions: InsightQuestion[]): string | undefined {
  if (questions.length === 0) {
    return undefined;
  }
  return JSON.stringify({
    version: INSIGHTS_ANNOTATION_VERSION,
    // Optional settings are omitted when unset, so a question saved before they existed serializes
    // unchanged and an edit that changes nothing is not recorded as a change.
    questions: questions.map(
      ({ id, question, sourcePanelKeys, followUps, compareWithPreviousPeriod, breakdownVariable }) => ({
        id,
        question,
        sourcePanelKeys,
        ...(followUps.length > 0 && { followUps }),
        ...(compareWithPreviousPeriod === true && { compareWithPreviousPeriod }),
        ...(breakdownVariable ? { breakdownVariable } : {}),
      })
    ),
  });
}

/** Writes both the serializer and meta.k8s so Save picks up the value and the change tracker sees it. */
export function writeInsightsAnnotation(host: InsightsAnnotationHost, value: string | undefined): void {
  const meta = host.state.meta;
  const annotations: Record<string, string> = {};
  const fromSerializer = host.serializer.getK8SMetadata()?.annotations ?? {};
  const fromMeta = meta.k8s?.annotations ?? {};
  for (const [key, annotation] of Object.entries({ ...fromSerializer, ...fromMeta })) {
    if (typeof annotation === 'string') {
      annotations[key] = annotation;
    }
  }

  if (value === undefined) {
    delete annotations[AnnoKeyInsights];
  } else {
    annotations[AnnoKeyInsights] = value;
  }

  host.serializer.setK8SAnnotations(annotations);
  host.setState({ meta: { ...meta, k8s: { ...meta.k8s, annotations } } });
}

export function hasInsightsAnnotationChanges(
  host: InsightsAnnotationHost & { getInitialState: () => { meta: { k8s?: Partial<ObjectMeta> } } | undefined }
): boolean {
  const initial = host.getInitialState()?.meta.k8s?.annotations?.[AnnoKeyInsights];
  return (initial ?? undefined) !== (getInsightsAnnotation(host) ?? undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

type StoredInsightQuestion = Omit<InsightQuestion, 'followUps'> & { followUps?: string[] };

function isStoredInsightQuestion(value: unknown): value is StoredInsightQuestion {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim() !== '' &&
    typeof value.question === 'string' &&
    value.question.trim() !== '' &&
    isStringArray(value.sourcePanelKeys) &&
    (value.followUps === undefined || isStringArray(value.followUps)) &&
    (value.compareWithPreviousPeriod === undefined || typeof value.compareWithPreviousPeriod === 'boolean') &&
    (value.breakdownVariable === undefined || typeof value.breakdownVariable === 'string')
  );
}
