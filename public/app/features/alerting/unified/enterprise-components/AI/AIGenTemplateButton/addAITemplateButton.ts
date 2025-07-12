import { ComponentType } from 'react';

// Define the props interface locally to avoid import issues
export interface GenAITemplateButtonProps {
  onTemplateGenerated: (template: string) => void;
  disabled?: boolean;
}

export let AITemplateButtonComponent: ComponentType<GenAITemplateButtonProps> | null = null;

export function addAITemplateButton(component: ComponentType<GenAITemplateButtonProps> | null) {
  AITemplateButtonComponent = component;
}
