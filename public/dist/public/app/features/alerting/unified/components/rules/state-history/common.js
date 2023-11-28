import { isEqual, uniqBy } from 'lodash';
// omit "common" labels from "labels"
export function omitLabels(labels, common) {
    return labels.filter((label) => {
        return !common.find((commonLabel) => JSON.stringify(commonLabel) === JSON.stringify(label));
    });
}
// find all common labels by looking at which ones occur in every record, then create a unique array of items for those
export function extractCommonLabels(labels) {
    const flatLabels = labels.flatMap((label) => label);
    const commonLabels = uniqBy(flatLabels.filter((label) => {
        const count = flatLabels.filter((l) => isEqual(label, l)).length;
        return count === Object.keys(labels).length;
    }), (label) => JSON.stringify(label));
    return commonLabels;
}
//# sourceMappingURL=common.js.map