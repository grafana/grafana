export function mapSet(set, callback) {
    const newSet = new Set();
    for (const el of set) {
        newSet.add(callback(el));
    }
    return newSet;
}
//# sourceMappingURL=set.js.map