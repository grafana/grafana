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

export function SetupWarnings({ showSetupButton = true, showSuccessBanner = false }: Props) {
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

  // Configure alert based on missing features
  const alertConfig = missingRequiredFeatures
    ? {
        severity: 'error' as const,
        title: 'Required Features Not Configured',
        message:
          'Some required features are not properly configured. Please complete the setup for these features to ensure the system runs properly.',
      }
    : {
        severity: 'info' as const,
        title: 'Additional Features Not Configured',
        message:
          'Some additional features like Github webhook integration or image renderer are not configured. These features may enhance your experience.',
      };

  const handleSetupClick = () => {
    locationService.push('/admin/provisioning/setup');
  };

  return (
    <Alert
      severity={alertConfig.severity}
      title={alertConfig.title}
      buttonContent={showSetupButton ? 'Set Up Now' : undefined}
      onRemove={showSetupButton ? handleSetupClick : undefined}
    >
      {alertConfig.message}
    </Alert>
  );
}
