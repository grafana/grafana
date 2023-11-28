export const minTags = (length) => (value) => {
    if (value != null && value.length >= length) {
        return undefined;
    }
    return `Must contain at least ${length} tag${length > 1 ? 's' : ''}`;
};
//# sourceMappingURL=minTags.js.map