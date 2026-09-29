import { type DataQuery } from '@grafana/schema';

/**
 * Whether the assistant should reason about the dashboard as a whole, or only about
 * an explicit set of panels.
 */
export type InsightScope = 'dashboard' | 'panels';

/** One panel the assistant should look at. */
export interface InsightPanelRef {
  panelId: number;
  panelTitle: string;
}

/**
 * The context handed to the assistant so it knows what to look at. Mirrors the shape
 * `buildAssistantPanelContext` produces for panel context items, extended with a panel list.
 */
export interface InsightContext {
  scope: InsightScope;
  dashboardUid?: string;
  dashboardTitle?: string;
  /** Empty when scope is `dashboard`, where every panel is in scope. */
  panels: InsightPanelRef[];
}

export interface InsightPanelConfig {
  prompt: string;
  context: InsightContext;
}

/** The field the insight datasource returns its markdown in. */
export const INSIGHT_FIELD_NAME = 'insight';

/**
 * Query sent to the insight datasource. `scenarioId`/`rawFrameContent` are the TestData DB
 * fields that stand in for it until the real datasource exists; `prompt`/`insightContext`
 * are what that datasource will consume.
 */
export interface InsightDataQuery extends DataQuery {
  prompt: string;
  insightContext: InsightContext;
  scenarioId: string;
  rawFrameContent: string;
}
