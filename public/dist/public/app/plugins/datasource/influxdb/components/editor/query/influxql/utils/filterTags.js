export function filterTags(parts, allTagKeys) {
    return parts.filter((t) => t.key.endsWith('::tag') || allTagKeys.has(t.key + '::tag'));
}
//# sourceMappingURL=filterTags.js.map