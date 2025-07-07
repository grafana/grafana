import { ComponentType } from 'react';

export let AIAlertRuleButtonComponent: ComponentType<{}> | null = null;

export function addAIAlertRuleButton(component: ComponentType<{}> | null) {
  AIAlertRuleButtonComponent = component;
}
