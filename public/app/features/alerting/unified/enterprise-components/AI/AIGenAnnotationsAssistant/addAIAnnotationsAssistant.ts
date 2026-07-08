import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

export interface AIAnnotationsAssistantProps {}

let RegisteredAIAnnotationsAssistantComponent: ComponentType<AIAnnotationsAssistantProps> | null = null;

export const AIAnnotationsAssistantComponent: ComponentType<AIAnnotationsAssistantProps> = (props) => {
  if (!RegisteredAIAnnotationsAssistantComponent) {
    return null;
  }

  return createElement(RegisteredAIAnnotationsAssistantComponent, props);
};

export function addAIAnnotationsAssistant(component: ComponentType<AIAnnotationsAssistantProps> | null) {
  RegisteredAIAnnotationsAssistantComponent = component
    ? withErrorBoundary(component, {
        title: t('alerting.ai.error-boundary.annotations-assistant', 'AI Annotations Assistant failed to load'),
        style: 'alertbox',
        errorLogger: logError,
      })
    : null;
}
