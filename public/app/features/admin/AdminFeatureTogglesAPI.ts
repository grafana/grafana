import { getBackendSrv } from '@grafana/runtime';

export type FeatureToggle = {
  name: string;
  description?: string;
  enabled: boolean;
  stage: string;
  readOnly?: boolean;
  hidden?: boolean;
};

export type CurrentTogglesState = {
  restartRequired: boolean;
  allowEditing: boolean;
  toggles: FeatureToggle[];
};

interface ResolvedToggleState {
  kind: 'ResolvedToggleState';
  restartRequired?: boolean;
  allowEditing?: boolean;
  toggles?: K8sToggleSpec[]; // not used in patch
  enabled: { [key: string]: boolean };
}

interface K8sToggleSpec {
  name: string;
  description: string;
  enabled: boolean;
  writeable: boolean;
  source: K8sToggleSource;
  stage: string;
}

interface K8sToggleSource {
  namespace: string;
  name: string;
}

interface FeatureTogglesAPI {
  getFeatureToggles(): Promise<CurrentTogglesState>;
  updateFeatureToggles(toggles: FeatureToggle[]): Promise<void>;
}

class K8sAPI implements FeatureTogglesAPI {
  baseURL = '/apis/featuretoggle.grafana.app/v0alpha1';

  async getFeatureToggles(): Promise<CurrentTogglesState> {
    const current = await getBackendSrv().get<ResolvedToggleState>(this.baseURL + '/current');
    return {
      restartRequired: Boolean(current.restartRequired),
      allowEditing: Boolean(current.allowEditing),
      toggles: current.toggles!.map((t) => ({
        name: t.name,
        description: t.description!,
        enabled: t.enabled,
        readOnly: !Boolean(t.writeable),
        stage: t.stage,
        hidden: false, // only return visible things
      })),
    };
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

export const getTogglesAPI = (): FeatureTogglesAPI => {
  return new K8sAPI();
};
