/**
 * The select component is really annoying -- if the current value is not in the list of options
 * it won't show up.  This is a wrapper to make that happen.
 */
export function getSelectionInfo(v, options) {
    if (v && !options) {
        const current = { label: `${v}`, value: v };
        return { options: [current], current };
    }
    if (!options) {
        options = [];
    }
    let current = options.find((item) => item.value === v);
    if (v && !current) {
        current = {
            label: `${v} (not found)`,
            value: v,
        };
        options.push(current);
    }
    return {
        options,
        current,
    };
}
//# sourceMappingURL=selection.js.map