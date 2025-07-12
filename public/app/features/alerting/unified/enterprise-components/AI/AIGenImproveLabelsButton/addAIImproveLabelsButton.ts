import { ComponentType } from 'react';

export let AIImproveLabelsButtonComponent: ComponentType<{}> | null = null;

export function addAIImproveLabelsButton(component: ComponentType<{}> | null) {
  AIImproveLabelsButtonComponent = component;
}
