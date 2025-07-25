import { ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../Analytics';

export type AIFeedbackOrigin = 'alert-rule' | 'template' | 'triage';

export interface GenAIFeedbackButtonProps {
  origin: AIFeedbackOrigin;
  shouldShowFeedbackButton?: boolean;
  // If true, the component will use the route detection to determine if the feedback should be shown
  // this is necessary for example in alerting rule form, where the feedback button is shown in the same page as the rule form
  useRouteDetection?: boolean;
}

let InternalAIFeedbackButtonComponent: ComponentType<GenAIFeedbackButtonProps> | null = null;

export const AIFeedbackButtonComponent: ComponentType<GenAIFeedbackButtonProps> = (props) => {
  if (!InternalAIFeedbackButtonComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalAIFeedbackButtonComponent, {
    title: t('alerting.ai.error-boundary.feedback-button', 'AI Feedback Button failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  // Provide default value for shouldShowFeedbackButton
  const propsWithDefaults = {
    shouldShowFeedbackButton: true,
    useRouteDetection: false,
    ...props,
  };

  return createElement(WrappedComponent, propsWithDefaults);
};

export function addAIFeedbackButton(component: ComponentType<GenAIFeedbackButtonProps> | null) {
  InternalAIFeedbackButtonComponent = component;
}
