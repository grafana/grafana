import { FeatureToggles } from '@grafana/data';

export interface InstructionStep {
  title: string;
  description?: string;
  code?: string;
  fulfilled?: boolean;
  copyCode?: boolean;
}

export interface FeatureInfo {
  title: string;
  description: string;
  steps: InstructionStep[];
  additional: boolean;
}

export interface InstructionStepComponentProps {
  step: InstructionStep;
  totalSteps: number;
  copied: boolean;
  onCopy: () => void;
}

export interface FeatureSetupModalProps {
  features: FeatureInfo[];
  isOpen: boolean;
  onDismiss: () => void;
  hasRequiredFeatures: boolean;
}

export interface CompactFeaturesListProps {
  features: FeatureInfo[];
}

export interface InstructionsModalProps {
  feature: FeatureInfo;
  isOpen: boolean;
  onDismiss: () => void;
}

// List of required feature toggles
export const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'provisioning',
  'kubernetesDashboards',
  'kubernetesClientDashboardsFolders',
  'unifiedStorageSearch',
  'unifiedStorageSearchUI',
];

// Configuration examples
export const feature_ini = `# In your custom.ini file
app_mode = development
[feature_toggles]
provisioning = true
kubernetesDashboards = true
unifiedStorageSearch = true
unifiedStorageSearchUI = true
kubernetesClientDashboardsFolders = true

# If you want easy kubectl setup development mode
grafanaAPIServerEnsureKubectlAccess = true`;

// Configuration examples
export const custom_ini = `# In your custom.ini file
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

export const ngrok_example = `ngrok http 3000

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

export const root_url_ini = `[server]
root_url = https://d60d-83-33-235-27.ngrok-free.app`;

export const render_ini = `[rendering]
server_url = http://localhost:8081/render
callback_url = http://localhost:3000/
`;
