import { useState, useEffect } from 'react';
import { Button, Box, Text, Stack } from '@grafana/ui';
import { Feature, feature_ini, ngrok_example, root_url_ini } from './types';
import { SetupModal } from './SetupModal';
import { FeatureCard } from './FeatureCard';
import { getConfigurationStatus } from './utils';

export const FeatureList = () => {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [showInstructionsModal, setShowModal] = useState(false);
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);

  const { hasPublicAccess, hasImageRenderer, hasRequiredFeatures } = getConfigurationStatus();

  useEffect(() => {
    const enableFeatureSteps = [
      {
        title: 'Enable Required Feature Toggles',
        description: 'Add these settings to your custom.ini file to enable necessary features:',
        code: feature_ini,
      },
    ];
    // Initialize features with their current status
    const featuresList: Feature[] = [
      {
        title: 'Provision As-Code',
        description:
          'Manage your dashboards as code and deploy them automatically from your Github repository or local storage',
        additional: false,
        setupSteps: enableFeatureSteps,
        isConfigured: hasRequiredFeatures,
        docsLink: 'https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles',
        icon: 'sync',
      },
      {
        title: 'Pull Requests',
        description:
          'Review, discuss, and approve dashboard changes with your team before they go live using Github pull requests',
        additional: false,
        setupSteps: enableFeatureSteps,
        icon: 'code-branch',
        isConfigured: hasRequiredFeatures,
        docsLink: 'https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles',
      },
      {
        title: 'Export As-Code',
        description:
          'Export your existing dashboards as code and store them in GitHub repositories for version control and collaboration',
        additional: false,
        setupSteps: enableFeatureSteps,
        icon: 'cloud-upload',
        isConfigured: hasRequiredFeatures,
        docsLink: 'https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles',
      },
      {
        title: 'Github Webhooks',
        description:
          'Automatically provision and update your dashboards as soon as changes are pushed to your Github repository',
        additional: true,
        icon: 'github',
        isConfigured: hasPublicAccess && hasRequiredFeatures,
        setupSteps: [
          {
            title: 'Start ngrok for temporary public access',
            description: 'Run this command to create a secure tunnel to your local Grafana:',
            code: 'ngrok http 3000',
          },
          {
            title: 'Copy your public URL',
            description: 'From the ngrok output, copy the https:// forwarding URL that looks like this:',
            code: ngrok_example,
            copyCode: false,
          },
          {
            title: 'Update your Grafana configuration',
            description: 'Add this to your custom.ini file, replacing the URL with your actual ngrok URL:',
            code: root_url_ini,
          },
        ],
      },
      {
        title: 'Previews',
        description:
          'Preview dashboard changes visually in pull requests before they go live, making team reviews faster and more effective',
        icon: 'camera',
        additional: true,
        isConfigured: hasImageRenderer && hasPublicAccess && hasRequiredFeatures,
        docsLink: 'https://grafana.com/grafana/plugins/grafana-image-renderer/',
        setupSteps: [],
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
    isConfigured: hasRequiredFeatures,
    setupSteps: [
      {
        title: 'Enable Required Feature Toggles',
        description: 'Add these settings to your custom.ini file to enable necessary features:',
        code: feature_ini,
      },
    ],
  });

  const showModal = (feature: Feature) => {
    // only show modal if feature is not configured
    if (!feature.isConfigured) {
      setActiveFeature(feature);
      setShowModal(true);
    }
  };

  const onDismiss = () => {
    setShowModal(false);
    setActiveFeature(null);
  };

  // Separate required and optional features
  const requiredFeatures = features.filter((feature) => !feature.additional);
  const optionalFeatures = features.filter((feature) => feature.additional);

  return (
    <Stack direction="column" gap={4}>
      <Text element="h1" variant="h2" textAlignment="center">
        All Features
      </Text>
      <Stack direction="row" gap={2} justifyContent="center">
        {requiredFeatures.map((feature, index) => (
          <FeatureCard
            key={index}
            feature={feature}
            onSetup={() => showModal(basicSetup)}
            showSetupButton={!feature.isConfigured}
          />
        ))}
        {optionalFeatures.map((feature, index) => (
          <FeatureCard
            key={index}
            feature={feature}
            onSetup={() => showModal(feature)}
            showSetupButton={!feature.isConfigured}
          />
        ))}
      </Stack>

      {showInstructionsModal && activeFeature && (
        <SetupModal feature={activeFeature} isOpen={true} onDismiss={onDismiss} />
      )}
    </Stack>
  );
};
