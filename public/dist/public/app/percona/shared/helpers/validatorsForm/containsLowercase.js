export const containsLowercase = (value) => {
    const casesRegexp = /^(?=.*[a-z])/gm;
    if (casesRegexp.test(value)) {
        return undefined;
    }
    return 'Must include at least one lowercase letter';
};
//# sourceMappingURL=containsLowercase.js.map