import { useState, useEffect } from 'react';
import { Button, useStyles2, Box, Icon, Text, Stack } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { FeatureInfo, requiredFeatureToggles, feature_ini, ngrok_example, root_url_ini, render_ini } from './types';
import { InstructionsModal } from './InstructionsModal';
import { config } from '@grafana/runtime';
import { FeatureCard } from './FeatureCard';

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
  };
};

export const SetupWizard = () => {
  const styles = useStyles2(getStyles);
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [activeFeature, setActiveFeature] = useState<FeatureInfo | null>(null);

  // Check if required feature toggles are enabled
  const checkRequiredFeatures = () => {
    const featureToggles = config.featureToggles || {};
    return requiredFeatureToggles.every((toggle) => featureToggles[toggle]);
  };

  // Check if public access is configured
  const checkPublicAccess = () => {
    return Boolean(config.appUrl && config.appUrl !== 'http://localhost:3000/');
  };

  // Check if image renderer is configured
  const checkImageRenderer = () => {
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
        fulfilled: checkRequiredFeatures(),
      },
    ],
  });

  const handleShowInstructions = (feature: FeatureInfo) => {
    // Only open the modal if the feature is not fully completed
    const allStepsFulfilled = feature?.steps.every((step) => step.fulfilled);
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
  const hasFeatureToggles = checkRequiredFeatures();

  return (
    <Stack direction="column" gap={4}>
      {!showInstructionsModal && (
        <>
          {requiredFeatures.length > 0 && (
            <Stack direction="column" gap={2}>
              <Text element="h3" variant="h4">
                Required Setup
                {hasFeatureToggles ? (
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

              <Stack direction="row" gap={2}>
                {requiredFeatures.map((feature, index) => (
                  <FeatureCard
                    key={index}
                    feature={feature}
                    onSetup={() => handleShowInstructions(feature)}
                    showSetupButton={false}
                  />
                ))}
              </Stack>

              {!hasFeatureToggles && (
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
                  {optionalFeatures.every((f) => f.steps.every((step) => step.fulfilled)) ? (
                    <Icon name="check-circle" color="green" />
                  ) : (
                    <Icon name="exclamation-triangle" color="orange" />
                  )}
                </Box>
              </Text>
              <Text color="secondary">
                These features are additional but can enhance your experience. We encourage you to set them up as well.
              </Text>

              <Stack direction="row" gap={2}>
                {optionalFeatures.map((feature, index) => (
                  <FeatureCard
                    key={index}
                    feature={feature}
                    onSetup={() => handleShowInstructions(feature)}
                    showSetupButton={true}
                  />
                ))}
              </Stack>
            </Stack>
          )}
        </>
      )}

      {showInstructionsModal && activeFeature && (
        <InstructionsModal feature={activeFeature} isOpen={true} onDismiss={handleInstructionsClose} />
      )}
    </Stack>
  );
};
