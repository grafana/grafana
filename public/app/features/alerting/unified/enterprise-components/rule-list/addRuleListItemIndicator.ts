import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';
import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { logError } from '../../Analytics';

export interface RuleListItemIndicatorProps {
  rule: GrafanaPromRuleDTO;
}

// Internal variable to store the actual component
let InternalRuleListItemIndicatorComponent: ComponentType<RuleListItemIndicatorProps> | null = null;

export const RuleListItemIndicatorComponent: ComponentType<RuleListItemIndicatorProps> = (props) => {
  if (!InternalRuleListItemIndicatorComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalRuleListItemIndicatorComponent, {
    title: t(
      'alerting.enterprise-components.error-boundary.rule-list-item-indicator',
      'Rule list item indicator failed to load'
    ),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addRuleListItemIndicator(component: ComponentType<RuleListItemIndicatorProps> | null) {
  InternalRuleListItemIndicatorComponent = component;
}
