import { ComponentType, createElement } from 'react';

import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

export interface GenAIImproveLabelsButtonProps {}

// Internal variable to store the actual component
let InternalAIImproveLabelsButtonComponent: ComponentType<GenAIImproveLabelsButtonProps> | null = null;

export const AIImproveLabelsButtonComponent: ComponentType<GenAIImproveLabelsButtonProps> = (props) => {
  if (!InternalAIImproveLabelsButtonComponent) {
    return null;
  }
  
  const WrappedComponent = withErrorBoundary(InternalAIImproveLabelsButtonComponent, {
    title: 'AI Improve Labels Button failed to load',
    style: 'alertbox',
    errorLogger: logError,
  });
  
  return createElement(WrappedComponent, props);
};

export function addAIImproveLabelsButton(component: ComponentType<GenAIImproveLabelsButtonProps> | null) {
  InternalAIImproveLabelsButtonComponent = component;
}
