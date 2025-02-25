import { useLocalStorage } from 'react-use';
import { useState, useEffect, useCallback, useRef } from 'react';

import { FeatureToggles, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Text, Collapse, Box, Button, InteractiveTable, IconButton, Modal, Card } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

import { useGetFrontendSettingsQuery } from './api';

// Add the CodeBlockWithCopy component
interface CodeBlockWithCopyProps {
  code: string;
  className?: string;
}

function CodeBlockWithCopy({ code, className }: CodeBlockWithCopyProps) {
  const styles = useStyles2(getStyles);
  const [copied, setCopied] = useState(false);
  const codeBlockRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);

    // Reset the copied state after a delay
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div className={`${styles.codeBlockWithCopy} ${className || ''}`}>
      <pre className={cx(styles.codeBlock, copied && styles.codeCopied)} ref={codeBlockRef}>
        <code>{code}</code>
        {copied && (
          <div className={styles.copyOverlay}>
            <span className={styles.copyMessage}>
              <i className="fa fa-check" /> Copied!
            </span>
          </div>
        )}
      </pre>
      <Button
        icon={copied ? 'check' : 'copy'}
        variant={copied ? 'success' : 'secondary'}
        size="sm"
        className={styles.copyButton}
        onClick={handleCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        tooltip={copied ? 'Copied to clipboard' : 'Copy to clipboard (Ctrl+C)'}
      />
    </div>
  );
}

interface InstructionStep {
  title: string;
  description?: string;
  code?: string;
}

interface FeatureInfo {
  title: string;
  description: string;
  steps: InstructionStep[];
  requiresPublicAccess: boolean;
}

interface InstructionStepComponentProps {
  step: InstructionStep;
  totalSteps: number;
  copied: boolean;
  onCopy: () => void;
}

function InstructionStepComponent({ step, totalSteps, copied, onCopy }: InstructionStepComponentProps) {
  const styles = useStyles2(getStyles);
  const codeBlockRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: step.description || '' }} />
      {step.code && (
        <div ref={codeBlockRef} className={cx(styles.codeBlockContainer, copied && styles.codeCopiedContainer)}>
          <pre className={cx(styles.codeBlock, copied && styles.codeCopied)}>
            <code>{step.code}</code>
            {copied && (
              <div className={styles.copyOverlay}>
                <span className={styles.copyMessage}>
                  <i className="fa fa-check" /> Copied to clipboard!
                </span>
              </div>
            )}
          </pre>
          <Button
            icon={copied ? 'check' : 'copy'}
            variant={copied ? 'success' : 'secondary'}
            size="sm"
            className={styles.copyButton}
            onClick={onCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
            tooltip={copied ? 'Copied to clipboard' : 'Copy to clipboard (Ctrl+C)'}
          />
        </div>
      )}
    </div>
  );
}

interface InstructionsModalProps {
  feature: FeatureInfo;
  isOpen: boolean;
  onDismiss: () => void;
}

function InstructionsModal({ feature, isOpen, onDismiss }: InstructionsModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const styles = useStyles2(getStyles);
  const [copied, setCopied] = useState(false);
  const codeBlockRef = useRef<HTMLDivElement>(null);

  if (!isOpen) {
    return null;
  }

  // Combine feature steps with public access steps if required
  const allSteps = [...feature.steps];

  if (feature.requiresPublicAccess) {
    allSteps.push(
      {
        title: 'Set up public access to your local machine',
        description:
          "You need a public URL for your local Grafana instance. We recommend using <a href='https://ngrok.com/' target='_blank' rel='noopener noreferrer'>ngrok</a> (click to visit website), but you can use any similar service:",
        code: ngrok_example,
      },
      {
        title: 'Configure the root_url in your custom.ini',
        description: 'Update your custom.ini with the ngrok URL:',
        code: root_url_ini,
      }
    );
  }

  const totalSteps = allSteps.length;
  const currentStep = allSteps[currentStepIndex];

  const handleNext = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }, [currentStepIndex, totalSteps]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index);
  };

  // Copy current step's code with Ctrl+C
  const copyCurrentStepCode = useCallback(() => {
    if (currentStep.code) {
      navigator.clipboard.writeText(currentStep.code);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);

      return true; // Indicate that we handled the copy
    }
    return false; // No code to copy
  }, [currentStep]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl+C for copying code
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Check if there's a text selection first
        const selectedText = window.getSelection()?.toString();

        // If there's no text selection or it's empty, copy the code
        if (!selectedText) {
          const handled = copyCurrentStepCode();
          if (handled) {
            // Prevent default only if we handled the copy
            e.preventDefault();
          }
        }
        // If there is a text selection, let the browser handle the copy
        return;
      }

      // Only handle arrow keys if no input elements are focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          handlePrevious();
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          handleNext();
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Clean up event listener on unmount or when modal closes
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleNext, handlePrevious, copyCurrentStepCode]);

  return (
    <Modal title={`Configure ${feature.title}`} isOpen={isOpen} onDismiss={onDismiss} className={styles.largeModal}>
      <div className={styles.modalContent}>
        {/* Step indicator sidebar - always shown */}
        <div className={styles.stepSidebar}>
          <div className={styles.timelineTrack}>
            {allSteps.map((step, index) => (
              <div key={index} className={styles.timelineItem}>
                {/* Connector line before the first step */}
                {index === 0 && <div className={styles.timelineConnectorStart}></div>}

                {/* Step indicator dot */}
                <div
                  className={cx(
                    styles.timelineStepIndicator,
                    index < currentStepIndex && styles.completedStep,
                    index === currentStepIndex && styles.activeStep,
                    index > currentStepIndex && styles.futureStep
                  )}
                  onClick={() => handleStepClick(index)}
                >
                  {index < currentStepIndex && <span className={styles.checkmark}>✓</span>}
                </div>

                {/* Step title */}
                <div
                  className={cx(
                    styles.timelineStepName,
                    index < currentStepIndex && styles.completedStepName,
                    index === currentStepIndex && styles.activeStepName,
                    index > currentStepIndex && styles.futureStepName
                  )}
                  onClick={() => handleStepClick(index)}
                >
                  {step.title}
                </div>

                {/* Connector line after each step except the last */}
                {index < allSteps.length - 1 && (
                  <div
                    className={cx(
                      styles.timelineConnector,
                      index < currentStepIndex && styles.completedConnector,
                      index === currentStepIndex && styles.activeConnector,
                      index > currentStepIndex && styles.futureConnector
                    )}
                  ></div>
                )}

                {/* Connector line after the last step */}
                {index === allSteps.length - 1 && <div className={styles.timelineConnectorEnd}></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className={styles.stepContent}>
          <div className={styles.contentWrapper}>
            <InstructionStepComponent
              step={currentStep}
              totalSteps={totalSteps}
              copied={copied}
              onCopy={copyCurrentStepCode}
            />
          </div>
        </div>
      </div>

      {/* Fixed navigation footer */}
      <div className={styles.navigationFooter}>
        <div className={styles.navigationButtons}>
          {totalSteps > 1 && (
            <Button onClick={handlePrevious} variant="secondary" icon="angle-left" disabled={currentStepIndex === 0}>
              Previous
            </Button>
          )}

          <div className={styles.keyboardHint}>
            {totalSteps > 1 ? <span>Use ←↑→↓ arrow keys to navigate</span> : null}
            {currentStep.code && <span>{totalSteps > 1 ? ' • ' : ''}Press Ctrl+C to copy code</span>}
          </div>

          <div className={styles.rightButtons}>
            {totalSteps > 1 && currentStepIndex < totalSteps - 1 ? (
              <Button onClick={handleNext} variant="primary" icon="angle-right">
                Next
              </Button>
            ) : (
              <Button onClick={onDismiss} variant="primary" icon="check">
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CompactFeaturesList({ features }: { features: FeatureInfo[] }) {
  const styles = useStyles2(getCompactStyles);

  return (
    <div>
      <ul className={styles.featuresList}>
        {features.map((feature) => (
          <li key={feature.title} className={styles.featureItem}>
            <div className={styles.featureContent}>
              <span className={styles.bulletPoint}>•</span>
              <div className={styles.titleWithInfo}>
                <Text element="span" weight="medium">
                  {feature.title}
                </Text>
                <IconButton
                  name="info-circle"
                  tooltip={feature.description}
                  className={styles.infoButton}
                  tooltipPlacement="top"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FeatureSetupModalProps {
  features: FeatureInfo[];
  isOpen: boolean;
  onDismiss: () => void;
}

function FeatureSetupModal({ features, isOpen, onDismiss }: FeatureSetupModalProps) {
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const styles = useStyles2(getStyles);
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return null;
  }

  // If no feature is selected, show the feature selection step
  if (!selectedFeature) {
    return (
      <Modal title="Setup Features" isOpen={isOpen} onDismiss={onDismiss} className={styles.largeModal}>
        <div className={styles.featureSelectionContent}>
          <Text element="p" color="secondary">
            Select a feature to set up:
          </Text>

          <div className={styles.featureSelectionList}>
            {features.map((feature) => (
              <div
                key={feature.title}
                className={styles.featureSelectionItem}
                onClick={() => setSelectedFeature(feature)}
              >
                <div style={{ flex: 1, paddingRight: '60px' }}>
                  <Text element="h4" weight="medium">
                    {feature.title}
                  </Text>
                  <Text element="p" color="secondary">
                    {feature.description}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.navigationFooter}>
          <div className={styles.navigationButtons}>
            <div></div>
            <Button onClick={onDismiss} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // Once a feature is selected, show the regular instructions modal
  // Combine feature steps with public access steps if required
  const allSteps = [...selectedFeature.steps];

  if (selectedFeature.requiresPublicAccess) {
    allSteps.push(
      {
        title: 'Set up public access to your local machine',
        description:
          "You need a public URL for your local Grafana instance. We recommend using <a href='https://ngrok.com/' target='_blank' rel='noopener noreferrer'>ngrok</a> (click to visit website), but you can use any similar service:",
        code: ngrok_example,
      },
      {
        title: 'Configure the root_url in your custom.ini',
        description: 'Update your custom.ini with the ngrok URL:',
        code: root_url_ini,
      }
    );
  }

  const totalSteps = allSteps.length;
  const currentStep = allSteps[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    } else {
      // If we're at the first step, go back to feature selection
      setSelectedFeature(null);
      setCurrentStepIndex(0);
    }
  };

  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index);
  };

  // Copy current step's code
  const copyCurrentStepCode = () => {
    if (currentStep.code) {
      navigator.clipboard.writeText(currentStep.code);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);

      return true;
    }
    return false;
  };

  return (
    <Modal
      title={`Configure ${selectedFeature.title}`}
      isOpen={isOpen}
      onDismiss={onDismiss}
      className={styles.largeModal}
    >
      <div className={styles.modalContent}>
        {/* Step indicator sidebar - always shown */}
        <div className={styles.stepSidebar}>
          <div className={styles.timelineTrack}>
            {allSteps.map((step, index) => (
              <div key={index} className={styles.timelineItem}>
                {/* Connector line before the first step */}
                {index === 0 && <div className={styles.timelineConnectorStart}></div>}

                {/* Step indicator dot */}
                <div
                  className={cx(
                    styles.timelineStepIndicator,
                    index < currentStepIndex && styles.completedStep,
                    index === currentStepIndex && styles.activeStep,
                    index > currentStepIndex && styles.futureStep
                  )}
                  onClick={() => handleStepClick(index)}
                >
                  {index < currentStepIndex && <span className={styles.checkmark}>✓</span>}
                </div>

                {/* Step title */}
                <div
                  className={cx(
                    styles.timelineStepName,
                    index < currentStepIndex && styles.completedStepName,
                    index === currentStepIndex && styles.activeStepName,
                    index > currentStepIndex && styles.futureStepName
                  )}
                  onClick={() => handleStepClick(index)}
                >
                  {step.title}
                </div>

                {/* Connector line after each step except the last */}
                {index < allSteps.length - 1 && (
                  <div
                    className={cx(
                      styles.timelineConnector,
                      index < currentStepIndex && styles.completedConnector,
                      index === currentStepIndex && styles.activeConnector,
                      index > currentStepIndex && styles.futureConnector
                    )}
                  ></div>
                )}

                {/* Connector line after the last step */}
                {index === allSteps.length - 1 && <div className={styles.timelineConnectorEnd}></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className={styles.stepContent}>
          <div className={styles.contentWrapper}>
            <InstructionStepComponent
              step={currentStep}
              totalSteps={totalSteps}
              copied={copied}
              onCopy={copyCurrentStepCode}
            />
          </div>
        </div>
      </div>

      {/* Fixed navigation footer */}
      <div className={styles.navigationFooter}>
        <div className={styles.navigationButtons}>
          <Button onClick={handlePrevious} variant="secondary" icon="angle-left">
            {currentStepIndex === 0 ? 'Back to Features' : 'Previous'}
          </Button>

          <div className={styles.keyboardHint}>
            {totalSteps > 1 ? <span>Use ←↑→↓ arrow keys to navigate</span> : null}
            {currentStep.code && <span>{totalSteps > 1 ? ' • ' : ''}Press Ctrl+C to copy code</span>}
          </div>

          <div className={styles.rightButtons}>
            {currentStepIndex < totalSteps - 1 ? (
              <Button onClick={handleNext} variant="primary" icon="angle-right">
                Next
              </Button>
            ) : (
              <Button onClick={onDismiss} variant="primary" icon="check">
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'provisioning',
  'kubernetesDashboards',
  'kubernetesClientDashboardsFolders',
  'unifiedStorageSearch',
  'unifiedStorageSearchUI',
];

const custom_ini = `# In your custom.ini file
app_mode = development
[feature_toggles]
provisioning = true
kubernetesDashboards = true
unifiedStorageSearch = true
unifiedStorageSearchUI = true
kubernetesClientDashboardsFolders = true

# If you want easy kubectl setup development mode
grafanaAPIServerEnsureKubectlAccess = true

# For Github webhook support, you will need something like:
[server]
root_url = https://supreme-exact-beetle.ngrok-free.app

# For dashboard preview generation, you will need something like:
[rendering]
server_url = http://localhost:8081/render
callback_url = http://localhost:3000/
 `;

const ngrok_example = `ngrok http 3000

Help shape K8s Bindings https://ngrok.com/new-features-update?ref=k8s

Session Status                online
Account                       Roberto Jiménez Sánchez (Plan: Free)
Version                       3.18.4
Region                        Europe (eu)
Latency                       44ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://d60d-83-33-235-27.ngrok-free.app -> http://localhost:3000
Connections                   ttl     opn     rt1     rt5     p50     p90
                              50      2       0.00    0.00    83.03   90.56

HTTP Requests
-------------

09:18:46.147 CET             GET  /favicon.ico                   302 Found
09:18:46.402 CET             GET  /login`;

const root_url_ini = `[server]
root_url = https://d60d-83-33-235-27.ngrok-free.app`;

const render_ini = `[rendering]
server_url = http://localhost:8081/render
callback_url = http://localhost:3000/
`;

export function SetupWarnings() {
  const [isCustomIniModalOpen, setCustomIniModalOpen] = useState(false);
  const settings = useGetFrontendSettingsQuery();
  const missingFeatures = requiredFeatureToggles.filter((feature) => !config.featureToggles[feature]);
  const styles = useStyles2(getStyles);
  const compactStyles = useStyles2(getCompactStyles);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Create a feature info object for the missing features
  const missingFeaturesInfo: FeatureInfo = {
    title: 'Required Features',
    description: 'Configure these required feature toggles for proper functionality',
    steps: [
      {
        title: 'Update your custom.ini file',
        description: 'Add the following configuration to enable required features:',
        code: custom_ini,
      },
    ],
    requiresPublicAccess: false,
  };

  // Prepare features data for the table
  const featuresData: FeatureInfo[] = [];

  if (settings.data?.generateDashboardPreviews === false) {
    featuresData.push({
      title: 'Dashboard Preview Generation',
      description: 'This feature generates dashboard preview images in pull requests.',
      steps: [
        {
          title: 'Install the Grafana Image Renderer',
          description:
            "You need to run the grafana-image-renderer service locally. Check out the <a href='https://github.com/grafana/grafana-image-renderer' target='_blank' rel='noopener noreferrer'>grafana-image-renderer GitHub repository</a> for more details:",
          code: 'git clone https://github.com/grafana/grafana-image-renderer.git\ncd grafana-image-renderer\nnpm install\nnpm run build\nnpm run start',
        },
        {
          title: 'Configure the rendering service',
          description: 'Connect to the rendering service locally with these settings:',
          code: render_ini,
        },
      ],
      requiresPublicAccess: true,
    });
  }

  if (settings.data?.githubWebhooks === false) {
    featuresData.push({
      title: 'Github Webhook Integration',
      description:
        'This feature automatically syncs resources from GitHub when commits are pushed to the configured branch, eliminating the need for regular polling intervals. It also enhances pull requests by automatically adding preview links and dashboard snapshots.',
      steps: [],
      requiresPublicAccess: true,
    });
  }

  if (
    missingFeatures.length === 0 &&
    settings.data?.githubWebhooks !== false &&
    settings.data?.generateDashboardPreviews !== false
  ) {
    return null;
  }

  return (
    <>
      {missingFeatures.length > 0 && (
        <>
          <Alert title="Some required features are disabled" severity="error" className={styles.alert}>
            <Box marginBottom={2}>
              <Text element="p">
                The following feature toggles are required for proper functionality but are currently disabled:
              </Text>
              <ul className={compactStyles.featuresList}>
                {missingFeatures.map((feature) => (
                  <li key={feature} className={compactStyles.featureItem}>
                    <div className={compactStyles.featureContent}>
                      <span className={compactStyles.bulletPoint}>•</span>
                      <div className={compactStyles.titleWithInfo}>
                        <Text element="span" weight="medium">
                          {feature}
                        </Text>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Box>
            <div className={styles.alertButtonWrapper}>
              <Button onClick={() => setCustomIniModalOpen(true)} variant="secondary" icon="info-circle">
                See example configuration
              </Button>
            </div>
          </Alert>

          <InstructionsModal
            feature={missingFeaturesInfo}
            isOpen={isCustomIniModalOpen}
            onDismiss={() => setCustomIniModalOpen(false)}
          />
        </>
      )}

      {featuresData.length > 0 && (
        <Alert severity="info" title="Some features are currently unavailable" className={styles.alert}>
          <Box marginBottom={2}>
            <Text element="p">These features enhance your whole experience working with Grafana and GitHub.</Text>
          </Box>

          <CompactFeaturesList features={featuresData} />

          <div className={styles.alertButtonWrapper}>
            <Button variant="secondary" icon="cog" onClick={() => setIsModalOpen(true)}>
              Setup Features
            </Button>
          </div>

          {isModalOpen && (
            <FeatureSetupModal features={featuresData} isOpen={isModalOpen} onDismiss={() => setIsModalOpen(false)} />
          )}
        </Alert>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    featureSection: css({
      marginBottom: theme.spacing(3),
      '&:last-child': {
        marginBottom: 0,
      },
    }),
    featureTitle: css({
      marginBottom: theme.spacing(1),
    }),
    codeBlockSimple: css({
      marginBottom: 0,
      width: '100%',
    }),
    codeBlockWithCopy: css({
      position: 'relative',
      marginBottom: theme.spacing(2),
      '&:focus': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
    copyButton: css({
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(1),
      zIndex: 1,
    }),
    expandedRow: css({
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(),
    }),
    stepDescription: css({
      '& a': {
        color: theme.colors.primary.text,
        textDecoration: 'underline',
        fontWeight: 500,
        '&:hover': {
          color: theme.colors.primary.shade,
          textDecoration: 'underline',
        },
      },
    }),
    stepSidebar: css({
      borderRight: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      width: '280px',
      overflowY: 'auto',
    }),
    timelineTrack: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      height: '100%',
      paddingLeft: theme.spacing(1),
    }),
    timelineItem: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      marginBottom: theme.spacing(3),
      '&:last-child': {
        marginBottom: 0,
      },
    }),
    timelineStepIndicator: css({
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.canvas,
      border: `2px solid ${theme.colors.border.medium}`,
      marginBottom: theme.spacing(1),
      cursor: 'pointer',
      zIndex: 2,
      transition: 'all 0.2s ease',
      fontSize: theme.typography.size.xs,
    }),
    timelineConnector: css({
      position: 'absolute',
      left: '8px',
      top: '16px',
      bottom: '-24px',
      width: '2px',
      backgroundColor: theme.colors.border.medium,
      zIndex: 1,
    }),
    timelineConnectorStart: css({
      position: 'absolute',
      left: '8px',
      top: '-16px',
      height: '16px',
      width: '2px',
      backgroundColor: theme.colors.border.medium,
      zIndex: 1,
    }),
    timelineConnectorEnd: css({
      position: 'absolute',
      left: '8px',
      top: '16px',
      height: '16px',
      width: '2px',
      backgroundColor: theme.colors.border.medium,
      zIndex: 1,
    }),
    timelineStepName: css({
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      marginLeft: theme.spacing(3),
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      wordBreak: 'break-word',
    }),
    activeStep: css({
      backgroundColor: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      borderColor: theme.colors.primary.main,
      boxShadow: theme.shadows.z2,
    }),
    completedStep: css({
      backgroundColor: theme.colors.success.main,
      color: theme.colors.success.contrastText,
      borderColor: theme.colors.success.main,
    }),
    futureStep: css({
      opacity: 0.6,
      filter: 'blur(0.5px)',
    }),
    activeStepName: css({
      color: theme.colors.text.primary,
    }),
    completedStepName: css({
      color: theme.colors.success.text,
    }),
    futureStepName: css({
      opacity: 0.6,
      filter: 'blur(0.5px)',
    }),
    completedConnector: css({
      backgroundColor: theme.colors.success.main,
    }),
    activeConnector: css({
      background: `linear-gradient(to bottom, ${theme.colors.success.main} 0%, ${theme.colors.border.medium} 100%)`,
    }),
    futureConnector: css({
      opacity: 0.6,
    }),
    checkmark: css({
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.fontWeightBold,
    }),
    stepContent: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      overflowY: 'auto',
    }),
    contentWrapper: css({
      padding: theme.spacing(3),
      flexGrow: 1,
    }),
    navigationFooter: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
      backgroundColor: theme.colors.background.primary,
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1,
    }),
    navigationButtons: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }),
    keyboardHint: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
      textAlign: 'center',
      flex: 1,
    }),
    rightButtons: css({
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    singleStepContent: css({
      padding: theme.spacing(3),
      minHeight: '200px',
      maxHeight: 'calc(80vh - 120px)',
      overflowY: 'auto',
    }),
    largeModal: css({
      width: '90%',
      maxWidth: '1000px',
      height: 'auto',
      maxHeight: '90vh',
    }),
    modalContent: css({
      display: 'flex',
      height: 'auto',
      minHeight: '300px',
      maxHeight: 'calc(80vh - 120px)',
    }),
    copyToast: css({
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: theme.colors.success.main,
      color: theme.colors.success.contrastText,
      padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
      borderRadius: theme.shape.borderRadius(),
      boxShadow: theme.shadows.z2,
      zIndex: 1000,
      animation: 'fadeIn 0.3s, fadeOut 0.5s 0.5s',
      animationFillMode: 'forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0 },
        to: { opacity: 1 },
      },
      '@keyframes fadeOut': {
        from: { opacity: 1 },
        to: { opacity: 0 },
      },
    }),
    codeBlockContainer: css({
      position: 'relative',
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderRadius: theme.shape.borderRadius(1),
      overflow: 'hidden',
      transition: 'all 0.2s ease-in-out',
    }),
    codeCopiedContainer: css({
      boxShadow: `0 0 0 2px ${theme.colors.success.border}`,
    }),
    codeBlock: css({
      position: 'relative',
      backgroundColor: theme.colors.background.secondary,
      color: theme.colors.text.primary,
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius(1),
      overflow: 'auto',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.size.sm,
      margin: 0,
      transition: 'all 0.2s ease-in-out',
    }),
    codeCopied: css({
      backgroundColor: theme.colors.success.transparent,
    }),
    copyOverlay: css({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      animation: 'fadeIn 0.2s, fadeOut 0.5s 1s',
      animationFillMode: 'forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0 },
        to: { opacity: 1 },
      },
      '@keyframes fadeOut': {
        from: { opacity: 1 },
        to: { opacity: 0 },
      },
    }),
    copyMessage: css({
      backgroundColor: theme.colors.success.main,
      color: theme.colors.success.contrastText,
      padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
      borderRadius: theme.shape.borderRadius(),
      fontWeight: theme.typography.fontWeightMedium,
      boxShadow: theme.shadows.z2,
    }),
    featureSelectionContent: css({
      padding: theme.spacing(3),
      overflowY: 'auto',
      maxHeight: 'calc(80vh - 120px)',
    }),
    featureSelectionList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      marginTop: theme.spacing(2),
    }),
    featureSelectionItem: css({
      padding: theme.spacing(2),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(1),
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
        boxShadow: theme.shadows.z1,
      },
    }),
    selectFeatureButton: css({
      position: 'absolute',
      right: theme.spacing(2),
      top: '50%',
      transform: 'translateY(-50%)',
    }),
    alert: css({
      position: 'relative',
    }),
    alertContent: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      paddingTop: theme.spacing(4),
    }),
    alertButtonWrapper: css({
      position: 'absolute',
      top: theme.spacing(2),
      right: theme.spacing(2),
      zIndex: 1,
    }),
  };
};

const getCompactStyles = (theme: GrafanaTheme2) => {
  return {
    featuresList: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    featureItem: css({
      padding: `${theme.spacing(0.5)} 0`,
      '&:last-child': {
        borderBottom: 'none',
      },
    }),
    featureContent: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    bulletPoint: css({
      fontSize: theme.typography.size.lg,
      color: theme.colors.text.secondary,
      marginRight: theme.spacing(0.5),
    }),
    titleWithInfo: css({
      display: 'flex',
      alignItems: 'center',
      flex: 1,
    }),
    infoButton: css({
      color: theme.colors.text.secondary,
      padding: 0,
      marginLeft: theme.spacing(0.5),
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};
