import { useState, useEffect } from 'react';
import { Button, useStyles2, Box, Icon, Text, Stack } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { Feature, feature_ini, ngrok_example, root_url_ini } from './types';
import { SetupModal } from './SetupModal';
import { FeatureCard } from './FeatureCard';
import { css } from '@emotion/css';
import { getConfigurationStatus } from './utils';

// Define minimal styles for elements that need specific styling
const getStyles = (theme: GrafanaTheme2) => {
  return {
    codeBlock: {
      backgroundColor: theme.colors.background.canvas,
      borderRadius: theme.shape.borderRadius(1),
      padding: theme.spacing(2),
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      overflowX: 'auto',
      marginBottom: theme.spacing(2),
    },
    cardContainer: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, 320px)',
      gap: theme.spacing(2),
      justifyContent: 'start',
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    }),
  };
};

export const SetupFeatures = () => {
  const styles = useStyles2(getStyles);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);

  const { hasPublicAccess, hasImageRenderer, hasRequiredFeatures } = getConfigurationStatus();

  useEffect(() => {
    // Initialize features with their current status

    const featuresList: Feature[] = [
      {
        title: 'Provision As-Code',
        description: 'Provision your dashboards from Github or other storage system',
        additional: false,
        setupSteps: [],
        icon: 'sync',
      },
      {
        title: 'Collaborate with Pull Requests',
        description: 'Collaborate with your team using pull requests',
        additional: false,
        setupSteps: [],
        icon: 'code-branch',
      },
      {
        title: 'Migrate Your Dashboards',
        description: 'Migrate your dashboards to Github or other storage system',
        additional: false,
        setupSteps: [],
        icon: 'cloud-upload',
      },
      {
        title: 'Github Webhooks',
        description: 'Seamless Github provisioning and collaboration with pull requests',
        additional: true,
        icon: 'github',
        setupSteps: [
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
            copyCode: false,
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
        title: 'Preview Snapshots',
        description: 'Attach preview images to pull requests comments',
        icon: 'camera',
        additional: true,
        setupSteps: [
          {
            title: 'Install Node.js',
            description: 'Install Node.js 16 or later on your system',
            fulfilled: hasImageRenderer,
          },
          {
            title: 'Clone the Image Renderer Repository',
            description: 'Clone the renderer repository:',
            code: 'git clone https://github.com/grafana/grafana-image-renderer.git',
            fulfilled: hasImageRenderer,
          },
          {
            title: 'Build the Renderer',
            description: 'Navigate to the directory and build:',
            code: 'cd grafana-image-renderer\nnpm install\nnpm run build',
            fulfilled: hasImageRenderer,
          },
          {
            title: 'Run the Renderer Service',
            description: 'Start the renderer service:',
            code: 'node build/app.js server --port=8081',
            fulfilled: hasImageRenderer,
          },
          {
            title: 'Configure Grafana',
            description: 'Add these settings to your grafana.ini file:',
            code: `[rendering]
rendering_server_url = http://localhost:8081/render
rendering_callback_url = http://your-grafana-instance/`,
            fulfilled: hasImageRenderer,
          },
        ],
      },
    ];

    setFeatures(featuresList);
  }, []);

  // Add a state variable to store the basic setup
  const [basicSetup] = useState<Feature>({
    title: 'Provisioning',
    description: 'Enable required Grafana features for provisioning',
    additional: false,
    icon: 'cog',
    setupSteps: [
      {
        title: 'Enable Required Feature Toggles',
        description: 'Add these settings to your custom.ini file to enable necessary features:',
        code: feature_ini,
        fulfilled: hasRequiredFeatures,
      },
    ],
  });

  const handleShowInstructions = (feature: Feature) => {
    // Only open the modal if the feature is not fully completed
    const allStepsFulfilled = feature?.setupSteps.every((step) => step.fulfilled);
    if (!allStepsFulfilled) {
      setActiveFeature(feature);
      setShowInstructionsModal(true);
    }
    // If all steps are fulfilled, don't open the modal
  };

  const handleInstructionsClose = () => {
    setShowInstructionsModal(false);
    setActiveFeature(null);
  };

  // Separate required and optional features
  const requiredFeatures = features.filter((feature) => !feature.additional);
  const optionalFeatures = features.filter((feature) => feature.additional);

  return (
    <Stack direction="column" gap={4}>
      {!showInstructionsModal && (
        <>
          {requiredFeatures.length > 0 && (
            <Stack direction="column" gap={2}>
              <Text element="h3" variant="h4">
                Required Setup
                {hasRequiredFeatures ? (
                  <Box display="inline" marginLeft={1}>
                    <Icon name="check-circle" color="green" />
                  </Box>
                ) : (
                  <Box display="inline" marginLeft={1}>
                    <Icon name="exclamation-triangle" color="red" />
                  </Box>
                )}
              </Text>
              <Text color="secondary">This setup is required for provisioning to work properly.</Text>

              <div className={styles.cardContainer}>
                {requiredFeatures.map((feature, index) => (
                  <FeatureCard
                    key={index}
                    feature={feature}
                    onSetup={() => handleShowInstructions(feature)}
                    showSetupButton={false}
                  />
                ))}
              </div>

              {!hasRequiredFeatures && (
                <Box marginTop={2}>
                  <Button variant="primary" onClick={() => handleShowInstructions(basicSetup)}>
                    Setup Now
                  </Button>
                </Box>
              )}
            </Stack>
          )}

          {optionalFeatures.length > 0 && (
            <Stack direction="column" gap={2}>
              <Text element="h3" variant="h4">
                Additional Features
                <Box display="inline" marginLeft={1}>
                  {optionalFeatures.every((f) => f.setupSteps.every((step) => step.fulfilled)) ? (
                    <Icon name="check-circle" color="green" />
                  ) : (
                    <Icon name="exclamation-triangle" color="orange" />
                  )}
                </Box>
              </Text>
              <Text color="secondary">
                These features are additional but can enhance your experience. We encourage you to set them up as well.
              </Text>

              <div className={styles.cardContainer}>
                {optionalFeatures.map((feature, index) => (
                  <FeatureCard
                    key={index}
                    feature={feature}
                    onSetup={() => handleShowInstructions(feature)}
                    showSetupButton={true}
                  />
                ))}
              </div>
            </Stack>
          )}
        </>
      )}

      {showInstructionsModal && activeFeature && (
        <SetupModal feature={activeFeature} isOpen={true} onDismiss={handleInstructionsClose} />
      )}
    </Stack>
  );
};
