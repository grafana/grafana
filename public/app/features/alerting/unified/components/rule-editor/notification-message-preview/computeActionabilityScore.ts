import { Annotation } from '../../../utils/constants';

export interface ActionabilityInput {
  annotations: Record<string, string>;
  labelCount: number;
}

export interface ActionabilityScore {
  score: number;
  missing: string[];
}

const SUMMARY_POINTS = 35;
const DESCRIPTION_POINTS = 35;
const RUNBOOK_POINTS = 20;
const LABELS_POINTS = 10;

export function computeActionabilityScore({ annotations, labelCount }: ActionabilityInput): ActionabilityScore {
  const missing: string[] = [];
  let score = 0;

  if (annotations[Annotation.summary]?.trim()) {
    score += SUMMARY_POINTS;
  } else {
    missing.push('summary');
  }

  if (annotations[Annotation.description]?.trim()) {
    score += DESCRIPTION_POINTS;
  } else {
    missing.push('description');
  }

  if (annotations[Annotation.runbookURL]?.trim()) {
    score += RUNBOOK_POINTS;
  } else {
    missing.push('runbook URL');
  }

  if (labelCount >= 1) {
    score += LABELS_POINTS;
  } else {
    missing.push('routing labels');
  }

  return { score, missing };
}

export function actionabilitySeverity(score: number): 'error' | 'warning' | 'success' {
  if (score < 40) {
    return 'error';
  }
  if (score < 75) {
    return 'warning';
  }
  return 'success';
}
