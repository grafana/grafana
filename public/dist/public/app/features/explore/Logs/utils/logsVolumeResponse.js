// Currently we can only infer if an error response is a timeout or not.
export function isTimeoutErrorResponse(response) {
    if (!response) {
        return false;
    }
    if (!response.error && !response.errors) {
        return false;
    }
    const errors = response.error ? [response.error] : response.errors || [];
    return errors.some((error) => {
        var _a, _b;
        const message = (_b = `${error.message || ((_a = error.data) === null || _a === void 0 ? void 0 : _a.message)}`) === null || _b === void 0 ? void 0 : _b.toLowerCase();
        return message.includes('timeout');
    });
}
//# sourceMappingURL=logsVolumeResponse.js.map