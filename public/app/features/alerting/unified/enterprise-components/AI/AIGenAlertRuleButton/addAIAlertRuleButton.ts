import { ComponentType, createElement } from 'react';

export interface GenAIAlertRuleButtonProps {}

// Internal variable to store the actual component
let InternalAIAlertRuleButtonComponent: ComponentType<GenAIAlertRuleButtonProps> | null = null;

export const AIAlertRuleButtonComponent: ComponentType<GenAIAlertRuleButtonProps> = (props) => {
  if (!InternalAIAlertRuleButtonComponent) {
    return null;
  }
  return createElement(InternalAIAlertRuleButtonComponent, props);
};

export function addAIAlertRuleButton(component: ComponentType<GenAIAlertRuleButtonProps> | null) {
  InternalAIAlertRuleButtonComponent = component;
}
