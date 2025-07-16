import { ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

export interface GenAIImproveAnnotationsButtonProps {}

// Internal variable to store the actual component
let InternalAIImproveAnnotationsButtonComponent: ComponentType<GenAIImproveAnnotationsButtonProps> | null = null;

export const AIImproveAnnotationsButtonComponent: ComponentType<GenAIImproveAnnotationsButtonProps> = (props) => {
  if (!InternalAIImproveAnnotationsButtonComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalAIImproveAnnotationsButtonComponent, {
    title: t('alerting.ai.error-boundary.improve-annotations-button', 'AI Improve Annotations Button failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addAIImproveAnnotationsButton(component: ComponentType<GenAIImproveAnnotationsButtonProps> | null) {
  InternalAIImproveAnnotationsButtonComponent = component;
}
