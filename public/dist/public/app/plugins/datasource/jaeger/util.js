import logfmt from 'logfmt';
export function convertTagsLogfmt(tags) {
    if (!tags) {
        return '';
    }
    const data = logfmt.parse(tags);
    Object.keys(data).forEach((key) => {
        const value = data[key];
        if (typeof value !== 'string') {
            data[key] = String(value);
        }
    });
    return JSON.stringify(data);
}
export function transformToLogfmt(tags) {
    if (!tags) {
        return '';
    }
    try {
        return logfmt.stringify(JSON.parse(tags));
    }
    catch (_a) {
        return tags;
    }
}
//# sourceMappingURL=util.js.map