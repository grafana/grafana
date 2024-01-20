import { getBackendSrv, config } from '@grafana/runtime';

type FeatureToggle = {
  name: string;
  description?: string;
  enabled: boolean;
  readOnly?: boolean;
  hidden?: boolean;
};

type FeatureMgmtState = {
  restartRequired: boolean;
  allowEditing: boolean;
};

interface ResolvedToggleState {
  kind: 'ResolvedToggleState';
  toggles?: K8sToggleSpec[]; // not used in patch
  enabled: { [key: string]: boolean };
}

interface K8sToggleSpec {
  name: string;
  description: string;
  enabled: boolean;
  writeable: boolean;
  source: K8sToggleSource;
}

interface K8sToggleSource {
  namespace: string;
  name: string;
}

interface FeatureTogglesAPI {
  getManagerState(): Promise<FeatureMgmtState>;
  getFeatureToggles(): Promise<FeatureToggle[]>;
  updateFeatureToggles(toggles: FeatureToggle[]): Promise<void>;
}

class LegacyAPI implements FeatureTogglesAPI {
  getManagerState(): Promise<FeatureMgmtState> {
    return getBackendSrv().get<FeatureMgmtState>('/featuremgmt/state');
  }
  getFeatureToggles(): Promise<FeatureToggle[]> {
    return getBackendSrv().get<FeatureToggle[]>('/featuremgmt');
  }
  updateFeatureToggles(toggles: FeatureToggle[]): Promise<void> {
    return getBackendSrv().post('/featuremgmt', { featureToggles: toggles });
  }
}

class K8sAPI implements FeatureTogglesAPI {
  baseURL = '/apis/featuretoggle.grafana.app/v0alpha1';

  getManagerState(): Promise<FeatureMgmtState> {
    return getBackendSrv().get<FeatureMgmtState>(this.baseURL + '/state');
  }
  async getFeatureToggles(): Promise<FeatureToggle[]> {
    const current = await getBackendSrv().get<ResolvedToggleState>(this.baseURL + '/current');
    return current.toggles!.map((t) => ({
      name: t.name,
      description: t.description!,
      enabled: t.enabled,
      readOnly: !Boolean(t.writeable),
      hidden: false, // only return visible things
    }));
  }
  updateFeatureToggles(toggles: FeatureToggle[]): Promise<void> {
    const patchBody: ResolvedToggleState = {
      kind: 'ResolvedToggleState',
      enabled: {},
    };
    toggles.forEach((t) => {
      patchBody.enabled[t.name] = t.enabled;
    });
    return getBackendSrv().patch(this.baseURL + '/current', patchBody);
  }
}

const getTogglesAPI = (): FeatureTogglesAPI => {
  return config.featureToggles.kubernetesFeatureToggles ? new K8sAPI() : new LegacyAPI();
};

export { getTogglesAPI };
export type { FeatureToggle, FeatureMgmtState };
