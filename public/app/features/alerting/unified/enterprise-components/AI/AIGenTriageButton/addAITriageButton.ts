import { ComponentType, createElement } from 'react';

import { TimeRange } from '@grafana/data';

import { LogRecord } from '../../../components/rules/state-history/common';

export interface GenAITriageButtonProps {
  logRecords: LogRecord[];
  timeRange: TimeRange;
}

export let InternalAITriageButtonComponent: ComponentType<GenAITriageButtonProps> | null = null;

export const AITriageButtonComponent: ComponentType<GenAITriageButtonProps> = (props) => {
  if (!InternalAITriageButtonComponent) {
    return null;
  }
  return createElement(InternalAITriageButtonComponent, props);
};

export function addAITriageButton(component: ComponentType<GenAITriageButtonProps> | null) {
  InternalAITriageButtonComponent = component;
}
