import { FeatureToggles } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';

// The feature and runtime state
export type FeatureToggle = {
  name: string;
  description: string;

  // RUNTIME
  enabled: boolean;

  // DEPENDS ON STATE
  readOnly?: boolean;
};

export type FeatureMgmtState = {
  restartRequired: boolean;
  allowEditing: boolean;

  // Configured in custom.ini
  hiddenToggles: string[];
  readOnlyToggles: string[];
};

export type FeatureInfo = {
  state: FeatureMgmtState;
  toggles: FeatureToggle[];
};

export interface FeatureManager {
  getInfo(): Promise<FeatureInfo>;
  updateToggles(toggles: FeatureToggle[]): Promise<void>;
}

// Read from the /api endpoint
class legacyAPI implements FeatureManager {
  async getInfo() {
    const state = await getBackendSrv().get<FeatureMgmtState>('api/featuremgmt/state');
    const toggles = await getBackendSrv().get<FeatureToggle[]>('api/featuremgmt');
    return { state, toggles };
  }

  updateToggles(featureToggles: FeatureToggle[]): Promise<void> {
    return getBackendSrv().post('api/featuremgmt', {
      featureToggles,
    });
  }
}

interface K8sFeaturesList {
  items: K8sFeatureFlag[];
}

interface K8sFeatureFlag {
  apiVersion: string;
  kind: 'Feature';
  metadata: {
    name: string;
  };
  spec: {
    description: string;
    stage: 'experimental' | 'privatePreview' | 'preview' | 'GA' | 'deprecated' | 'unknown';
    allowSelfServe?: boolean;
    hideFromAdminPage?: boolean;
  };
}

// Read from the /api endpoint
class k8sAPI implements FeatureManager {
  readonly apiVersion = 'featureflags.grafana.app/v0alpha1';
  readonly featuresURL: string;

  constructor() {
    // Cluster scoped API (features exist across namespaces)
    this.featuresURL = `/apis/${this.apiVersion}/features`;
  }

  async getInfo() {
    const toggles: FeatureToggle[] = [];
    const state = await getBackendSrv().get<FeatureMgmtState>('api/featuremgmt/state');
    const result = await getBackendSrv().get<K8sFeaturesList>(this.featuresURL);

    const readOnly = new Set(state.readOnlyToggles ?? []);
    const hiddenToggles = new Set(state.hiddenToggles ?? []);
    for (let v of result.items) {
      const name = v.metadata.name;
      if (v.spec.hideFromAdminPage || hiddenToggles.has(name)) {
        continue; // hide
      }
      if (!(v.spec.stage === 'preview' || v.spec.stage === 'GA')) {
        continue; // hide
      }

      const writeable = Boolean(v.spec.allowSelfServe) && !readOnly.has(name) && v.spec.stage === 'GA';

      toggles.push({
        name,
        description: v.spec.description,
        enabled: Boolean(config.featureToggles[v.metadata.name as keyof FeatureToggles]),
        readOnly: !writeable,
      });
    }
    return { state, toggles };
  }

  updateToggles(featureToggles: FeatureToggle[]): Promise<void> {
    return getBackendSrv().post('api/featuremgmt', {
      featureToggles,
    });
  }
}

let instance: FeatureManager | null = null;

export function getFeatureManager(): FeatureManager {
  if (!instance) {
    instance = config.featureToggles.kubernetesFeatureToggles ? new k8sAPI() : new legacyAPI();
  }
  return instance;
}
