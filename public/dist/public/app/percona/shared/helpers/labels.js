import { HIDDEN_LABELS, PRIMARY_LABELS } from '../core';
export const formatLabel = (label) => {
    const [key, value] = label;
    return `${key}=${value}`;
};
export const formatLabels = (labels) => {
    const alertLabels = {
        primary: [],
        secondary: [],
    };
    Object.entries(labels).forEach(([key, value]) => {
        const formattedLabel = formatLabel([key, value]);
        if (PRIMARY_LABELS.includes(key)) {
            alertLabels.primary.push(formattedLabel);
        }
        else if (!HIDDEN_LABELS.includes(key)) {
            alertLabels.secondary.push(formattedLabel);
        }
    });
    return alertLabels;
};
//# sourceMappingURL=labels.js.map