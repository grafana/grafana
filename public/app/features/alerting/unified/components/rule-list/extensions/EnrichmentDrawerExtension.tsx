import { ComponentType, memo } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

export interface EnrichmentDrawerExtensionProps {
  ruleUid: string;
  onClose: () => void;
}

// Internal variable to store the extension component, for now only one component is supported
let InternalEnrichmentDrawerExtension: ComponentType<EnrichmentDrawerExtensionProps> | null = null;

// This component is used to render the enrichment drawer extension.
const EnrichmentDrawerExtensionComponent: ComponentType<EnrichmentDrawerExtensionProps> = (props) => {
  if (!InternalEnrichmentDrawerExtension) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalEnrichmentDrawerExtension, {
    title: t(
      'alerting.enrichment.error-boundary.enrichment-drawer-extension',
      'Enrichment Drawer Extension failed to load'
    ),
    style: 'alertbox',
    errorLogger: logError,
  });

  return <WrappedComponent {...props} />;
};

export const EnrichmentDrawerExtension = memo(EnrichmentDrawerExtensionComponent, (prevProps, nextProps) => {
  // Only re-render if ruleUid changes
  return prevProps.ruleUid === nextProps.ruleUid;
});

export function addEnrichmentDrawerExtension(component: ComponentType<EnrichmentDrawerExtensionProps>) {
  InternalEnrichmentDrawerExtension = component;
}
