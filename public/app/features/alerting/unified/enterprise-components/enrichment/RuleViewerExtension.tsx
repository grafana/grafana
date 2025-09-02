import { ComponentType } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';
import { RulePageEnrichmentSectionProps } from 'app/extensions/alerting/enrichment/ruleViewPageExtensions/EnrichmentSection';

import { logError } from '../../Analytics';

let InternalRulePageEnrichmentSection: ComponentType<RulePageEnrichmentSectionProps> | null = null;

export const RulePageEnrichmentSectionExtension: ComponentType<RulePageEnrichmentSectionProps> = (props) => {
  if (!InternalRulePageEnrichmentSection) {
    return null;
  }

  const WrappedComponent = withErrorBoundary(InternalRulePageEnrichmentSection, {
    title: t(
      'alerting.enrichment.error-boundary.rule-viewer-section-extension',
      'Rule Viewer Enrichment Section failed to load'
    ),
    style: 'alertbox',
    errorLogger: logError,
  });

  return <WrappedComponent {...props} />;
};

export function addRulePageEnrichmentSection(component: ComponentType<RulePageEnrichmentSectionProps>) {
  InternalRulePageEnrichmentSection = component;
}
