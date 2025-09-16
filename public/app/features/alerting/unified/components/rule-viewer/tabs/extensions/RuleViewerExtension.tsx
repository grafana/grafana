import { ComponentType } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../../Analytics';

export interface RuleViewerExtensionProps {}

let InternalRulePageEnrichmentSection: ComponentType<RuleViewerExtensionProps> | null = null;

export const RulePageEnrichmentSectionExtension: ComponentType<RuleViewerExtensionProps> = (props) => {
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

export function addRulePageEnrichmentSection(component: ComponentType<RuleViewerExtensionProps>) {
  InternalRulePageEnrichmentSection = component;
}
