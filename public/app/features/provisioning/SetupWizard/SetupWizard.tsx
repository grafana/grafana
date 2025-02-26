import { useState, useEffect } from 'react';
import { Button, useStyles2, LinkButton, Box, Alert, Icon } from '@grafana/ui';
import { getStyles } from './styles';
import { FeatureInfo, requiredFeatureToggles, feature_ini, ngrok_example, root_url_ini, render_ini } from './types';
import { InstructionsModal } from './InstructionsModal';
import { config } from '@grafana/runtime';
import { SetupWarnings } from '../SetupWarnings';

export const SetupWizard = () => {
  const styles = useStyles2(getStyles);
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [hasRequiredFeatures, setHasRequiredFeatures] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);

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

    const featuresList: FeatureInfo[] = [
      {
        title: 'As-Code Provisioning',
        description: 'Provision your dashboards from Github or other storage system',
        additional: false,
        steps: [],
      },
      {
        title: 'Collaborate with Pull Requests',
        description: 'Collaborate with your team by creating pull requests for your dashboards',
        additional: false,
        steps: [],
      },
      {
        title: 'Migrate Your Dashboards',
        description: 'Migrate your dashboards to Github or other storage system',
        additional: false,
        steps: [],
      },
      {
        title: 'Github Webhooks Integration',
        description:
          'Make your Grafana instance accessible from the internet to enable a more seamless provisioning and collaboration with pull requests',
        additional: true,
        steps: [
          {
            title: 'Start ngrok for temporary public access',
            description: 'Run this command to create a secure tunnel to your local Grafana:',
            code: 'ngrok http 3000',
            fulfilled: hasPublicAccess,
          },
          {
            title: 'Copy your public URL',
            description: 'From the ngrok output, copy the https:// forwarding URL that looks like this:',
            code: ngrok_example,
            fulfilled: hasPublicAccess,
          },
          {
            title: 'Update your Grafana configuration',
            description: 'Add this to your custom.ini file, replacing the URL with your actual ngrok URL:',
            code: root_url_ini,
            fulfilled: hasPublicAccess,
          },
        ],
      },
      {
        title: 'Dashboard Preview Screenshots',
        description: 'Set up the image renderer to generate screenshots for dashboard previews in GitHub pull requests',
        additional: true,
        steps: [
          {
            title: 'Install the Image Renderer Plugin',
            description: 'Run this command in your Grafana server to install the official renderer plugin:',
            code: 'grafana-cli plugins install grafana-image-renderer',
            fulfilled: hasImageRenderer,
          },
          {
            title: 'Configure the Image Renderer',
            description: 'Add these settings to your custom.ini file to enable the renderer:',
            code: render_ini,
            fulfilled: hasImageRenderer,
          },
        ],
      },
    ];

    setFeatures(featuresList);
  }, []);

  const handleFeatureSelect = (index: number) => {
    // Only open the modal if the feature is not fully completed
    const feature = features[index];
    const allStepsFulfilled = feature?.steps.every((step) => step.fulfilled);

    if (!allStepsFulfilled) {
      setSelectedFeature(index);
    }
    // If all steps are fulfilled, don't open the modal
  };

  const handleInstructionsClose = () => {
    setSelectedFeature(null);
  };

  // Separate required and optional features
  const requiredFeatures = features.filter((feature) => !feature.additional);
  const optionalFeatures = features.filter((feature) => feature.additional);
  const hasFeatureToggles = checkRequiredFeatures();

  // Add a state variable to store the basic setup
  const [basicSetup] = useState<FeatureInfo>({
    title: 'Provisioning',
    description: 'Enable required Grafana features for provisioning',
    additional: false,
    steps: [
      {
        title: 'Enable Required Feature Toggles',
        description: 'Add these settings to your custom.ini file to enable necessary features:',
        code: feature_ini,
        fulfilled: hasFeatureToggles,
      },
    ],
  });

  return (
    <div>
      {selectedFeature === null && (
        <>
          {requiredFeatures.length > 0 && (
            <>
              <h3 className={styles.title}>Required Setup</h3>
              <p className={styles.subtitle}>This setup is required for provisioning to work properly.</p>
              <div className={styles.featuresList}>
                {requiredFeatures.map((feature, index) => {
                  return (
                    <div key={index} className={styles.featureItem}>
                      <div className={styles.featureHeader}>
                        <h4 className={styles.featureTitle}>{feature.title}</h4>
                      </div>
                      <p className={styles.featureDescription}>{feature.description}</p>
                    </div>
                  );
                })}
              </div>
              {!hasFeatureToggles ? (
                <Button variant="primary" onClick={() => setSelectedFeature(-1)} className={styles.featureButton}>
                  Setup Now
                </Button>
              ) : (
                <div className={styles.configuredStatus}>
                  <Icon name="check-circle" className={styles.configuredIcon} /> Configured
                </div>
              )}
            </>
          )}

          {optionalFeatures.length > 0 && (
            <>
              <Box marginTop={4}>
                <h3 className={styles.title}>Additional Features</h3>
                <p className={styles.subtitle}>
                  These features are additional but can enhance your experience. We encourage you to set them up as
                  well.
                </p>
                <div className={styles.featuresList}>
                  {optionalFeatures.map((feature, index) => {
                    const featureIndex = features.findIndex((f) => f.title === feature.title);
                    const allStepsFulfilled = feature.steps.every((step) => step.fulfilled);

                    return (
                      <div key={index} className={styles.featureItem}>
                        <div className={styles.featureHeader}>
                          <h4 className={styles.featureTitle}>{feature.title}</h4>
                        </div>
                        <p className={styles.featureDescription}>{feature.description}</p>
                        {!allStepsFulfilled && (
                          <Button
                            variant="primary"
                            onClick={() => handleFeatureSelect(featureIndex)}
                            className={styles.featureButton}
                          >
                            Setup Now
                          </Button>
                        )}
                        {allStepsFulfilled && (
                          <div className={styles.configuredStatus}>
                            <Icon name="check-circle" className={styles.configuredIcon} /> Configured
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Box>
            </>
          )}
        </>
      )}

      {selectedFeature !== null && (
        <InstructionsModal
          feature={selectedFeature === -1 ? basicSetup : features[selectedFeature]}
          isOpen={true}
          onDismiss={handleInstructionsClose}
        />
      )}
    </div>
  );
};
