import { useState } from 'react';

import { FeatureToggles, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Alert } from '@grafana/ui';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

import { SetupWizard } from './SetupWizard';

// List of required feature toggles
const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'provisioning',
  'kubernetesDashboards',
  'kubernetesClientDashboardsFolders',
  'unifiedStorageSearch',
  'unifiedStorageSearchUI',
];

export function SetupWarnings() {
  const [showSetupModal, setShowSetupModal] = useState(false);
  const styles = useStyles2(getStyles);

  // Check if required feature toggles are enabled
  const checkRequiredFeatures = () => {
    const featureToggles = config.featureToggles || {};
    return requiredFeatureToggles.every((toggle) => featureToggles[toggle]);
  };

  // Check if public access is configured
  const checkPublicAccess = () => {
    // This is a simplified check - in a real implementation, you would check
    // if the server's root_url is properly configured for external access
    return Boolean(config.appUrl && config.appUrl !== 'http://localhost:3000/');
  };

  // Check if image renderer is configured
  const checkImageRenderer = () => {
    return Boolean(config.rendererAvailable);
  };

  const hasRequiredFeatures = checkRequiredFeatures();
  const hasPublicAccess = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();

  const missingOnlyOptionalFeatures = hasRequiredFeatures && (!hasPublicAccess || !hasImageRenderer);
  const missingRequiredFeatures = !hasRequiredFeatures;
  const showWarning = missingRequiredFeatures || missingOnlyOptionalFeatures;

  const handleSetupClick = () => {
    setShowSetupModal(true);
  };

  const handleCloseSetupModal = () => {
    setShowSetupModal(false);
  };

  if (!showWarning) {
    return null;
  }

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
    <>
      <Alert severity={alertSeverity} title={alertTitle} buttonContent="Setup Features" onRemove={handleSetupClick}>
        {alertMessage}
      </Alert>

      {showSetupModal && (
        <div className={styles.setupWizardContainer}>
          <SetupWizard />
          <Button variant="secondary" onClick={handleCloseSetupModal} className={styles.closeButton}>
            Close
          </Button>
        </div>
      )}
    </>
  );
}

interface SetupWarningsStyles {
  setupWizardContainer: string;
  closeButton: string;
}

const getStyles = (theme: GrafanaTheme2): SetupWarningsStyles => {
  return {
    setupWizardContainer: css({
      padding: theme.spacing(2),
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.shape.borderRadius(),
      boxShadow: theme.shadows.z3,
      marginTop: theme.spacing(2),
    }),
    closeButton: css({
      marginTop: theme.spacing(2),
    }),
  };
};
