import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';
import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { logError } from '../../Analytics';

export interface RuleListItemIndicatorProps {
  rule: GrafanaPromRuleDTO;
}

let RegisteredRuleListItemIndicatorComponent: ComponentType<RuleListItemIndicatorProps> | null = null;

export const RuleListItemIndicatorComponent: ComponentType<RuleListItemIndicatorProps> = (props) => {
  if (!RegisteredRuleListItemIndicatorComponent) {
    return null;
  }

  return createElement(RegisteredRuleListItemIndicatorComponent, props);
};

export function addRuleListItemIndicator(component: ComponentType<RuleListItemIndicatorProps> | null) {
  RegisteredRuleListItemIndicatorComponent = component
    ? withErrorBoundary(component, {
        title: t(
          'alerting.enterprise-components.error-boundary.rule-list-item-indicator',
          'Rule list item indicator failed to load'
        ),
        style: 'alertbox',
        errorLogger: logError,
      })
    : null;
}
