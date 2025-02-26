import React, { useState, useEffect } from 'react';
import { Button, useStyles2, Alert, LinkButton } from '@grafana/ui';
import { getStyles } from './styles';
import { FeatureInfo, requiredFeatureToggles, custom_ini, ngrok_example, root_url_ini, render_ini } from './types';
import { FeatureSetupModal } from './FeatureSetupModal';
import { config } from '@grafana/runtime';

export const SetupWizard = () => {
  const styles = useStyles2(getStyles);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [hasRequiredFeatures, setHasRequiredFeatures] = useState(true);

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
    // This is a simplified check - in a real implementation, you would check
    // if the rendering service is properly configured and accessible
    return Boolean(config.rendererAvailable);
  };

  useEffect(() => {
    // Initialize features with their current status
    const hasPublicAccess = checkPublicAccess();
    const hasImageRenderer = checkImageRenderer();
    const hasFeatureToggles = checkRequiredFeatures();

    const featuresList: FeatureInfo[] = [
      {
        title: 'Feature Toggles',
        description: 'Configure required feature toggles for Kubernetes integration',
        requiresPublicAccess: true,
        steps: [
          {
            title: 'Enable Required Feature Toggles',
            description: 'Add the following to your custom.ini file:',
            code: custom_ini,
            fulfilled: hasFeatureToggles,
          },
        ],
      },
      {
        title: 'Public Access',
        description: 'Configure public access to your Grafana instance',
        requiresPublicAccess: true,
        steps: [
          {
            title: 'Start ngrok',
            description: 'Run the following command to start ngrok:',
            code: 'ngrok http 3000',
            fulfilled: hasPublicAccess,
          },
          {
            title: 'Copy the ngrok URL',
            description: 'Copy the forwarding URL from the ngrok output:',
            code: ngrok_example,
            fulfilled: hasPublicAccess,
          },
          {
            title: 'Update root_url in custom.ini',
            description: 'Add the following to your custom.ini file:',
            code: root_url_ini,
            fulfilled: hasPublicAccess,
          },
        ],
      },
      {
        title: 'Image Renderer',
        description: 'Configure the image renderer for dashboard previews',
        requiresPublicAccess: false,
        steps: [
          {
            title: 'Install the Image Renderer Plugin',
            description: 'Run the following command to install the plugin:',
            code: 'grafana-cli plugins install grafana-image-renderer',
            fulfilled: hasImageRenderer,
          },
          {
            title: 'Configure the Image Renderer',
            description: 'Add the following to your custom.ini file:',
            code: render_ini,
            fulfilled: hasImageRenderer,
          },
        ],
      },
    ];

    setFeatures(featuresList);
    setHasRequiredFeatures(hasFeatureToggles && hasPublicAccess);
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div>
      {!hasRequiredFeatures && (
        <Alert
          severity="warning"
          title="Required Features Not Configured"
          buttonContent="Setup Features"
          onRemove={handleOpenModal}
        >
          Some required features are not properly configured. Please complete the setup for these features to ensure
          full functionality.
        </Alert>
      )}

      <div className={styles.featuresList}>
        {features.map((feature, index) => {
          const allStepsFulfilled = feature.steps.every((step) => step.fulfilled);

          return (
            <div key={index} className={styles.featureItem}>
              <h4 className={styles.featureTitle}>
                {feature.title}
                {allStepsFulfilled && <span className={styles.fulfilledBadge}>Completed</span>}
              </h4>
              <p className={styles.featureDescription}>{feature.description}</p>
              <Button
                variant={feature.requiresPublicAccess ? 'primary' : 'secondary'}
                onClick={handleOpenModal}
                className={styles.featureButton}
              >
                {allStepsFulfilled ? 'View Setup' : 'Setup Now'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <LinkButton
          href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/"
          variant="secondary"
          target="_blank"
        >
          View Documentation
        </LinkButton>
      </div>

      <FeatureSetupModal
        features={features}
        isOpen={isModalOpen}
        onDismiss={handleCloseModal}
        hasRequiredFeatures={hasRequiredFeatures}
      />
    </div>
  );
};
