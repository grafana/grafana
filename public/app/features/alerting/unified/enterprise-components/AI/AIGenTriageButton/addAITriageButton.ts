import { ComponentType } from 'react';

import { TimeRange } from '@grafana/data';

import { LogRecord } from '../../../components/rules/state-history/common';

export interface GenAITriageButtonProps {
  className?: string;
  logRecords: LogRecord[];
  timeRange: TimeRange;
}

export let AITriageButtonComponent: ComponentType<GenAITriageButtonProps> | null = null;

export function addAITriageButton(component: ComponentType<GenAITriageButtonProps> | null) {
  AITriageButtonComponent = component;
}
