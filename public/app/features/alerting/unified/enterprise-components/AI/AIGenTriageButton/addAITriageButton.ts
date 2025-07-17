import { ComponentType, createElement } from 'react';

import { TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';
import { LogRecord } from '../../../components/rules/state-history/common';

export interface GenAITriageButtonProps {
  logRecords: LogRecord[];
  timeRange: TimeRange;
}

let InternalAITriageButtonComponent: ComponentType<GenAITriageButtonProps> | null = null;

export const AITriageButtonComponent: ComponentType<GenAITriageButtonProps> = (props) => {
  if (!InternalAITriageButtonComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalAITriageButtonComponent, {
    title: t('alerting.ai.error-boundary.triage-button', 'AI Triage Button failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addAITriageButton(component: ComponentType<GenAITriageButtonProps> | null) {
  InternalAITriageButtonComponent = component;
}
