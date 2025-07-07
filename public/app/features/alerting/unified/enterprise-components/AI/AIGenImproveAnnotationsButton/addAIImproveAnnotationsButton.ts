import { ComponentType } from 'react';

export let AIImproveAnnotationsButtonComponent: ComponentType<{}> | null = null;

export function addAIImproveAnnotationsButton(component: ComponentType<{}> | null) {
  AIImproveAnnotationsButtonComponent = component;
}
