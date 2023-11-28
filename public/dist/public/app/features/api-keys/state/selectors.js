export const getApiKeysCount = (state) => state.includeExpired ? state.keysIncludingExpired.length : state.keys.length;
export const getApiKeys = (state) => {
    const regex = RegExp(state.searchQuery, 'i');
    const keysToFilter = state.includeExpired ? state.keysIncludingExpired : state.keys;
    return keysToFilter.filter((key) => {
        return regex.test(key.name) || regex.test(key.role);
    });
};
export const getIncludeExpired = (state) => state.includeExpired;
export const getIncludeExpiredDisabled = (state) => state.keys.length === 0 && state.keysIncludingExpired.length > 0;
//# sourceMappingURL=selectors.js.map