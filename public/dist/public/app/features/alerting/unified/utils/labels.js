export function labelsToTags(labels) {
    return Object.entries(labels)
        .map(([label, value]) => `${label}=${value}`)
        .sort();
}
export function objectLabelsToArray(labels) {
    return Object.entries(labels).map(([label, value]) => [label, value]);
}
export function arrayLabelsToObject(labels) {
    const labelsObject = {};
    labels.forEach((label) => {
        labelsObject[label[0]] = label[1];
    });
    return labelsObject;
}
export function arrayKeyValuesToObject(labels) {
    const labelsObject = {};
    labels.forEach((label) => {
        label.key && (labelsObject[label.key] = label.value);
    });
    return labelsObject;
}
//# sourceMappingURL=labels.js.map