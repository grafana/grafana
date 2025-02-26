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
  const { everythingConfigured, missingOnlyOptionalFeatures, missingRequiredFeatures } = getConfigurationStatus();

  const handleSetupClick = () => {
    locationService.push('/admin/provisioning/setup');
  };

  // If everything is configured and we don't want to show success banner, return null
  if (everythingConfigured && !showSuccessBanner) {
    return null;
  }

  // If everything is configured and we want to show success banner
  if (everythingConfigured && showSuccessBanner) {
    return (
      <Alert severity="success" title="All Features Configured">
        All required and optional features are properly configured. Your system is ready to use.
      </Alert>
    );
  }

  // If there are warnings to show
  let alertTitle = '';
  let alertMessage = '';
  let alertSeverity: 'error' | 'info' = 'error';

  if (missingRequiredFeatures) {
    alertTitle = 'Required Features Not Configured';
    alertMessage =
      'Some required features are not properly configured. Please complete the setup for these features to ensure the system runs properly.';
    alertSeverity = 'error';
  } else if (missingOnlyOptionalFeatures) {
    alertTitle = 'Additional Features Not Configured';
    alertMessage =
      'Some additional features like Github webhook integration or image renderer are not configured. These features may enhance your experience.';
    alertSeverity = 'info';
  }

  return (
    <Alert
      severity={alertSeverity}
      title={alertTitle}
      buttonContent={showSetupButton ? 'Set Up Now' : undefined}
      onRemove={showSetupButton ? handleSetupClick : undefined}
    >
      {alertMessage}
    </Alert>
  );
}
