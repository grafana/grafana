export const sameTags = (a = [], b = []) => {
    const same = a.length === b.length && a.every((tag) => b.includes(tag));
    return same;
};
//# sourceMappingURL=tags.js.map