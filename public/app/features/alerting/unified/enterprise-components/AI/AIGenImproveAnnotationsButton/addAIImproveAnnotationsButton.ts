import { ComponentType, createElement } from 'react';

export interface GenAIImproveAnnotationsButtonProps {}

// Internal variable to store the actual component
let InternalAIImproveAnnotationsButtonComponent: ComponentType<GenAIImproveAnnotationsButtonProps> | null = null;

export const AIImproveAnnotationsButtonComponent: ComponentType<GenAIImproveAnnotationsButtonProps> = (props) => {
  if (!InternalAIImproveAnnotationsButtonComponent) {
    return null;
  }
  return createElement(InternalAIImproveAnnotationsButtonComponent, props);
};

export function addAIImproveAnnotationsButton(component: ComponentType<GenAIImproveAnnotationsButtonProps> | null) {
  InternalAIImproveAnnotationsButtonComponent = component;
}
