import { ComponentType, createElement } from 'react';

// Define the props interface locally to avoid import issues
export interface GenAITemplateButtonProps {
  onTemplateGenerated: (template: string) => void;
  disabled?: boolean;
}

export let InternalAITemplateButtonComponent: ComponentType<GenAITemplateButtonProps> | null = null;

// this is the component that is used by the consumer in the grafana repo
export const AITemplateButtonComponent: ComponentType<GenAITemplateButtonProps> = (props) => {
  if (!InternalAITemplateButtonComponent) {
    return null;
  }
  return createElement(InternalAITemplateButtonComponent, props);
};

export function addAITemplateButton(component: ComponentType<GenAITemplateButtonProps> | null) {
  InternalAITemplateButtonComponent = component;
}
