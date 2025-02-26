import { useState, useEffect } from 'react';
import { Button, useStyles2, Box, Icon } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { FeatureInfo, requiredFeatureToggles, feature_ini, ngrok_example, root_url_ini, render_ini } from './types';
import { InstructionsModal } from './InstructionsModal';
import { config } from '@grafana/runtime';
import { FeatureCard } from './FeatureCard';

// Define styles directly in this file
const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css({
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      marginBottom: theme.spacing(1),
    }),
    subtitle: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
    }),
    featuresList: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(3),
    }),
    featureItem: css({
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(1),
      padding: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    featureHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(1),
    }),
    featureTitle: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      margin: 0,
    }),
    featureDescription: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
      flex: 1,
    }),
    featureButton: css({
      alignSelf: 'flex-start',
    }),
    configuredStatus: css({
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.success.text,
      fontSize: theme.typography.body.fontSize,
      marginTop: 'auto',
    }),
    configuredIcon: css({
      color: theme.colors.success.main,
      marginRight: theme.spacing(1),
    }),
    codeBlock: css({
      backgroundColor: theme.colors.background.canvas,
      borderRadius: theme.shape.borderRadius(1),
      padding: theme.spacing(2),
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      overflowX: 'auto',
      marginBottom: theme.spacing(2),
    }),
    copyButton: css({
      marginLeft: theme.spacing(1),
    }),
    copyIcon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    checkIcon: css({
      marginRight: theme.spacing(0.5),
    }),
  };
};

// Also include the CompactStyles that were in styles.ts
export const getCompactStyles = (theme: GrafanaTheme2) => {
  return {
    featuresList: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
    featureItem: css`
      display: flex;
      align-items: flex-start;
      padding: ${theme.spacing(1)};
    `,
    featureContent: css`
      margin-left: ${theme.spacing(1)};
    `,
    bulletPoint: css`
      color: ${theme.colors.primary.text};
      margin-right: ${theme.spacing(1)};
    `,
    titleWithInfo: css`
      display: flex;
      align-items: center;
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    infoButton: css`
      background: transparent;
      border: none;
      color: ${theme.colors.text.secondary};
      cursor: pointer;
      padding: 0;
      margin-left: ${theme.spacing(0.5)};
      &:hover {
        color: ${theme.colors.text.primary};
      }
    `,
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
    <div>
      {!showInstructionsModal && (
        <>
          {requiredFeatures.length > 0 && (
            <>
              <h3 className={styles.title}>Required Setup</h3>
              <p className={styles.subtitle}>This setup is required for provisioning to work properly.</p>
              <div className={styles.featuresList}>
                {requiredFeatures.map((feature, index) => {
                  return (
                    <FeatureCard key={index} feature={feature} onSetup={() => {}} showSetupButton={hasFeatureToggles} />
                  );
                })}
              </div>
              {!hasFeatureToggles && (
                <Button
                  variant="primary"
                  onClick={() => handleShowInstructions(basicSetup)}
                  className={styles.featureButton}
                >
                  Setup Now
                </Button>
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
                    return (
                      <FeatureCard
                        key={index}
                        feature={feature}
                        onSetup={() => handleShowInstructions(feature)}
                        showSetupButton={true}
                      />
                    );
                  })}
                </div>
              </Box>
            </>
          )}
        </>
      )}

      {showInstructionsModal && activeFeature && (
        <InstructionsModal feature={activeFeature} isOpen={true} onDismiss={handleInstructionsClose} />
      )}
    </div>
  );
};
