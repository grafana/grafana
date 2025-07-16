import { ComponentType, createElement } from 'react';

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
  
  const WrappedComponent = withErrorBoundary(InternalAITemplateButtonComponent, {
    title: 'AI Template Button failed to load',
    style: 'alertbox',
    errorLogger: logError,
  });
  
  return createElement(WrappedComponent, props);
};

export function addAITemplateButton(component: ComponentType<GenAITemplateButtonProps> | null) {
  InternalAITemplateButtonComponent = component;
}
