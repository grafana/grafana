import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

export interface AIAnnotationsAssistantProps {}

// Internal variable to store the actual component
let InternalAIAnnotationsAssistantComponent: ComponentType<AIAnnotationsAssistantProps> | null = null;

export const AIAnnotationsAssistantComponent: ComponentType<AIAnnotationsAssistantProps> = (props) => {
  if (!InternalAIAnnotationsAssistantComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalAIAnnotationsAssistantComponent, {
    title: t('alerting.ai.error-boundary.annotations-assistant', 'AI Annotations Assistant failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addAIAnnotationsAssistant(component: ComponentType<AIAnnotationsAssistantProps> | null) {
  InternalAIAnnotationsAssistantComponent = component;
}
