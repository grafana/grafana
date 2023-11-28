import { DEFAULT_SUFFIX, VERSION_PREFIX, } from '../Kubernetes/ManageComponentsVersionsModal/ManageComponentsVersionsModal.constants';
export const getComponentChange = (operator, component, componentsVersions) => {
    const name = `${operator}${component}`;
    const defaultName = `${name}${DEFAULT_SUFFIX}`;
    const versions = componentsVersions[name];
    const defaultVersion = componentsVersions[defaultName];
    return {
        default_version: defaultVersion.name.replace(VERSION_PREFIX, ''),
        versions: versions.map(({ label, value }) => (Object.assign(Object.assign({ version: label }, (value && { enable: true })), (!value && { disable: true })))),
    };
};
//# sourceMappingURL=DBCluster.service.utils.js.map