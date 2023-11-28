export function sortWithSubsections(items) {
    if (!items.some((i) => i.isSubheader) || !items.some((i) => i.divider)) {
        return items;
    }
    const sections = [];
    let current = [];
    items.forEach((item) => {
        current.push(item);
        if (item.divider) {
            sections.push(current);
            current = [];
        }
    });
    if (current.length) {
        sections.push(current);
    }
    const sorted = [];
    sections.forEach((section) => {
        const header = section.find((i) => i.isSubheader);
        const items = section.filter((i) => !i.isSubheader);
        if (header) {
            sorted.push(header, ...items);
        }
        else {
            sorted.push(...items);
        }
    });
    return sorted;
}
//# sourceMappingURL=navigation.js.map