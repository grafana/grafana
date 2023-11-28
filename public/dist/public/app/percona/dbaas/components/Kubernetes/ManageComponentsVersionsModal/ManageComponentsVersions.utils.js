import { __rest } from "tslib";
import React from 'react';
import { DBClusterComponentVersionStatus } from '../../DBCluster/DBCluster.types';
import { OptionContent } from '../../DBCluster/OptionContent/OptionContent';
import { DEFAULT_SUFFIX, VERSION_PREFIX } from './ManageComponentsVersionsModal.constants';
import { Messages } from './ManageComponentsVersionsModal.messages';
import { ManageComponentVersionsFields, SupportedComponents, } from './ManageComponentsVersionsModal.types';
export const requiredVersions = (versions) => {
    if (!versions || !Array.isArray(versions)) {
        return undefined;
    }
    const checked = versions.filter((v) => v.value);
    return checked.length > 0 ? undefined : Messages.required;
};
export const componentsToOptions = (value) => Object.keys(value)
    .filter((key) => key in SupportedComponents)
    .map((key) => ({
    name: key,
    value: key,
    label: Messages.componentLabel[key],
}));
export const versionsToOptions = (component) => Object.entries(component).map(([key, { status, disabled, default: isDefault }]) => ({
    name: `${VERSION_PREFIX}${key}`,
    value: !disabled,
    label: key,
    status,
    default: isDefault,
}));
export const buildVersionsFieldName = (values) => {
    if (!values[ManageComponentVersionsFields.operator] || !values[ManageComponentVersionsFields.component]) {
        return undefined;
    }
    return `${values[ManageComponentVersionsFields.operator].value}${values[ManageComponentVersionsFields.component].value}`;
};
export const buildDefaultFieldName = (values) => {
    if (!values[ManageComponentVersionsFields.operator] || !values[ManageComponentVersionsFields.component]) {
        return undefined;
    }
    return `${values[ManageComponentVersionsFields.operator].value}${values[ManageComponentVersionsFields.component].value}${DEFAULT_SUFFIX}`;
};
export const findRecommendedVersions = (versions) => versions.filter(({ status }) => status === DBClusterComponentVersionStatus.recommended);
export const findDefaultVersion = (versions) => versions.find(({ default: isDefault }) => isDefault);
export const getDefaultOptions = (values) => {
    const versionsFieldName = buildVersionsFieldName(values);
    const options = (versionsFieldName ? values[versionsFieldName] : []);
    return options.filter(({ value }) => value);
};
export const defaultRequired = (option) => (option && option.label ? undefined : Messages.required);
export const parseDefaultVersionsOptions = (options) => options.map((_a) => {
    var { label, status } = _a, option = __rest(_a, ["label", "status"]);
    return (Object.assign(Object.assign({}, option), { status, label: (React.createElement(OptionContent, { title: label, tags: status === DBClusterComponentVersionStatus.recommended ? [Messages.recommended] : [], dataTestId: "kubernetes-default-version-option" })) }));
});
//# sourceMappingURL=ManageComponentsVersions.utils.js.map