import { ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

export interface GenAITemplateButtonProps {
  onTemplateGenerated: (template: string) => void;
  disabled?: boolean;
}

let InternalAITemplateButtonComponent: ComponentType<GenAITemplateButtonProps> | null = null;

// this is the component that is used by the consumer in the grafana repo
export const AITemplateButtonComponent: ComponentType<GenAITemplateButtonProps> = (props) => {
  if (!InternalAITemplateButtonComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalAITemplateButtonComponent, {
    title: t('alerting.ai.error-boundary.template-button', 'AI Template Button failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addAITemplateButton(component: ComponentType<GenAITemplateButtonProps> | null) {
  InternalAITemplateButtonComponent = component;
}
