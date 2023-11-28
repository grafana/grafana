import { config } from '@grafana/runtime';
export const isDatagridEnabled = () => {
    return config.featureToggles.enableDatagridEditing;
};
//# sourceMappingURL=featureFlagUtils.js.map