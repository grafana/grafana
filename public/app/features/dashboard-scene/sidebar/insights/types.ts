import { type InsightOptions } from 'app/plugins/panel/text/panelcfg.gen';

/** A question saved in the dashboard sidebar, with the same question, sources, and follow-ups as an Insight panel. */
export interface InsightQuestion extends InsightOptions {
  id: string;
}

/** Exact over every original point, even when the values are bucket averages. */
export interface InsightFieldStats {
  count: number;
  first: number;
  firstAt: string;
  last: number;
  lastAt: string;
  min: number;
  minAt: string;
  max: number;
  maxAt: string;
  mean: number;
}

export interface InsightSnapshotField {
  name: string;
  type: string;
  unit?: string;
  labels?: Record<string, string>;
  values: unknown[];
  stats?: InsightFieldStats;
}

export interface InsightFrameSummary {
  note: string;
  originalRows: number;
  buckets: number;
  bucketSeconds: number;
}

export interface InsightSnapshotFrame {
  name?: string;
  /** Present when the frame had too many points to send exactly. */
  summary?: InsightFrameSummary;
  fields: InsightSnapshotField[];
}

export interface InsightSnapshotPanel {
  key: string;
  title: string;
  description: string;
  /** The tab and row the panel sits in, such as "LLM usage › Tokens". */
  section?: string;
  frames: InsightSnapshotFrame[];
}

/** An event the source panels show, such as a deploy or an incident. */
export interface InsightSnapshotAnnotation {
  time: string;
  /** Set when the annotation is a region. */
  timeEnd?: string;
  text: string;
  tags?: string[];
}

/** The source panels over another time range. */
export interface InsightSnapshotPeriod {
  from: string;
  to: string;
  panels: InsightSnapshotPanel[];
}

export interface InsightBreakdownValue {
  /** The value the queries received. */
  value: string;
  /** The value as the variable picker shows it. */
  text: string;
  /** The source panels that use the variable, captured with only this value selected. */
  panels: InsightSnapshotPanel[];
  /** The same panels over the previous period, when the question compares periods. */
  previousPeriod?: InsightSnapshotPanel[];
}

export interface InsightBreakdown {
  variable: string;
  values: InsightBreakdownValue[];
  /** Values left out to keep the request small; never dropped silently. */
  omittedValues: number;
}

export interface InsightSnapshot {
  question: string;
  dashboardUid: string;
  from: string;
  to: string;
  variables: Record<string, string>;
  panels: InsightSnapshotPanel[];
  annotations?: InsightSnapshotAnnotation[];
  /** Older annotations left out to keep the request small; never dropped silently. */
  omittedAnnotations?: number;
  /** The source panels over the period just before `from`, as long as the time range. */
  previousPeriod?: InsightSnapshotPeriod;
  breakdown?: InsightBreakdown;
}

export type InsightContext = Pick<InsightSnapshot, 'question' | 'dashboardUid' | 'from' | 'to' | 'variables'>;

/** The panel and time window a finding is based on, so the viewer can check it. */
export interface InsightEvidence {
  /** A source panel's key from the snapshot. */
  panel: string;
  from?: string;
  to?: string;
}

export interface InsightFinding {
  label: string;
  detail: string;
  evidence?: InsightEvidence;
}

export interface InsightAnswer {
  headline: string;
  findings: InsightFinding[];
  caveat: string;
  /** One takeaway per variable value, as the variable picker shows it, when the question is broken down. */
  breakdown?: Array<{ value: string; headline: string }>;
}

/** Who shared an answer with everyone who opens the dashboard, and when. */
export interface InsightShare {
  annotationId: number;
  login: string;
  avatarUrl?: string;
  sharedAt: string;
}

export interface InsightResult {
  content: InsightAnswer;
  snapshot: InsightSnapshot;
  completedAt: string;
  sourceLocation: string;
  /** Set when the answer is the dashboard's shared answer rather than one asked in this session. */
  share?: InsightShare;
  /**
   * The shared copy left out the captured values to fit storage, so the answer cannot be followed up
   * in place or compared with current data.
   */
  framesOmitted?: boolean;
}
