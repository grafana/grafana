import { locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';

import { getConfigurationStatus } from './utils';

interface Props {
  /**
   * Whether to show the "Setup Now" button
   * @default true
   */
  showSetupButton?: boolean;

  /**
   * Whether to show a success banner when everything is configured
   * @default false
   */
  showSuccessBanner?: boolean;
}

export function StatusAlerts({ showSetupButton = true, showSuccessBanner = false }: Props) {
  const { everythingConfigured, missingRequiredFeatures } = getConfigurationStatus();

  // Early return if everything is configured and we don't want to show success banner
  if (everythingConfigured && !showSuccessBanner) {
    return null;
  }

  // Handle success case
  if (everythingConfigured) {
    return (
      <Alert severity="success" title="All Features Configured">
        All required and optional features are properly configured. Your system is ready to use.
      </Alert>
    );
  }

  const handleSetupClick = () => {
    locationService.push('/admin/provisioning/setup');
  };

  const commonSetupButtonProps = showSetupButton
    ? {
        buttonContent: 'Set Up Now',
        onRemove: handleSetupClick,
      }
    : {};

  // Required features missing - show error alert
  if (missingRequiredFeatures) {
    return (
      <Alert severity="error" title="Required Features Not Configured" {...commonSetupButtonProps}>
        Some required features are not properly configured. Please complete the setup for these features to ensure the
        system runs properly.
      </Alert>
    );
  }

  // Only optional features missing - show info alert
  return (
    <Alert severity="info" title="Additional Features Not Configured" {...commonSetupButtonProps}>
      Some additional features like GitHub webhook integration or Previews are not configured. These features can
      enhance your experience.
    </Alert>
  );
}
