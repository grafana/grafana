import { useLocalStorage } from 'react-use';
import { useState } from 'react';

import { FeatureToggles, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Text, Collapse, Box, Button, InteractiveTable, IconButton, Modal } from '@grafana/ui';
import { css } from '@emotion/css';
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

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);

    // Reset the copied state after a delay
    setTimeout(() => {
      setCopied(false);
    }, 500);
  };

  return (
    <div className={`${styles.codeBlockWithCopy} ${className || ''}`}>
      <pre className={styles.codeBlock}>
        <code>{code}</code>
      </pre>
      <Button
        icon={copied ? 'check' : 'copy'}
        variant={copied ? 'success' : 'secondary'}
        size="sm"
        className={styles.copyButton}
        onClick={handleCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        tooltip={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
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

function InstructionStepComponent({
  step,
  index,
  totalSteps,
}: {
  step: InstructionStep;
  index: number;
  totalSteps: number;
}) {
  const styles = useStyles2(getStyles);

  return (
    <Box marginBottom={3}>
      <Text element="h5">{totalSteps > 1 ? `Step ${index + 1}: ${step.title}` : step.title}</Text>
      {step.description && (
        <Box marginY={1}>
          <div className={styles.stepDescription} dangerouslySetInnerHTML={{ __html: step.description }} />
        </Box>
      )}
      {step.code && <CodeBlockWithCopy code={step.code} />}
    </Box>
  );
}

interface InstructionsModalProps {
  feature: FeatureInfo;
  isOpen: boolean;
  onDismiss: () => void;
}

function InstructionsModal({ feature, isOpen, onDismiss }: InstructionsModalProps) {
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

  return (
    <Modal title={`Configure ${feature.title}`} isOpen={isOpen} onDismiss={onDismiss}>
      <Box padding={3}>
        {allSteps.map((step, index) => (
          <InstructionStepComponent key={index} step={step} index={index} totalSteps={allSteps.length} />
        ))}
      </Box>
    </Modal>
  );
}

function FeaturesTable({ features }: { features: FeatureInfo[] }) {
  const styles = useStyles2(getStyles);
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo | null>(null);

  const columns = [
    {
      id: 'feature',
      header: 'Feature',
      cell: ({ row }: { row: { original: FeatureInfo } }) => {
        return <Text weight="medium">{row.original.title}</Text>;
      },
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ row }: { row: { original: FeatureInfo } }) => {
        return <Text>{row.original.description}</Text>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: FeatureInfo } }) => {
        return (
          <Button size="sm" variant="secondary" onClick={() => setSelectedFeature(row.original)} icon="info-circle">
            Setup Instructions
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <InteractiveTable columns={columns} data={features} getRowId={(row) => row.title} />

      {selectedFeature && (
        <InstructionsModal
          feature={selectedFeature}
          isOpen={selectedFeature !== null}
          onDismiss={() => setSelectedFeature(null)}
        />
      )}
    </div>
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
          <Alert title="Some required features are disabled" severity="error">
            <Box marginBottom={2}>
              <Text element="p">
                The following feature toggles are required for proper functionality but are currently disabled:
              </Text>
              {missingFeatures.map((feature) => (
                <li key={feature}>
                  <strong>{feature}</strong>
                </li>
              ))}
            </Box>
            <Button onClick={() => setCustomIniModalOpen(true)} variant="secondary" icon="info-circle">
              See example configuration
            </Button>
          </Alert>

          <InstructionsModal
            feature={missingFeaturesInfo}
            isOpen={isCustomIniModalOpen}
            onDismiss={() => setCustomIniModalOpen(false)}
          />
        </>
      )}

      {featuresData.length > 0 && (
        <Alert severity="info" title="Some features are currently unavailable">
          <Box marginBottom={2}>
            <Text element="p">These features enhance your whole experience working with Grafana and GitHub.</Text>
          </Box>

          <FeaturesTable features={featuresData} />
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
    codeBlock: css({
      marginBottom: 0,
      width: '100%',
    }),
    codeBlockWithCopy: css({
      position: 'relative',
      marginBottom: theme.spacing(2),
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
  };
};
