import { __awaiter } from "tslib";
import { parse } from 'yaml';
export const onKubeConfigValueChange = (value, updateFormMutator) => {
    const defaultName = getClusterNameFromKubeConfig(value);
    updateFormMutator(value, defaultName);
};
const getClusterNameFromKubeConfig = (value) => {
    if (value) {
        try {
            const parsedYAML = parse(value);
            const clusters = parsedYAML === null || parsedYAML === void 0 ? void 0 : parsedYAML.clusters;
            if (clusters && clusters.length) {
                const clusterWithName = clusters.find((item) => (item === null || item === void 0 ? void 0 : item.name) != null);
                if (clusterWithName) {
                    return clusterWithName.name;
                }
            }
        }
        catch (e) {
            return undefined;
        }
    }
    return undefined;
};
const getFromClipboard = () => __awaiter(void 0, void 0, void 0, function* () {
    if (navigator.clipboard.readText) {
        return navigator.clipboard.readText();
    }
    return Promise.resolve(undefined);
});
export const pasteFromClipboard = (updateFormMutator) => __awaiter(void 0, void 0, void 0, function* () {
    const kubeConfig = yield getFromClipboard();
    if (kubeConfig) {
        const defaultName = getClusterNameFromKubeConfig(kubeConfig);
        updateFormMutator(kubeConfig, defaultName);
    }
});
//# sourceMappingURL=EditK8sClusterPage.utils.js.map