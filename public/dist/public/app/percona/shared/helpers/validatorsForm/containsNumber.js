export const containsNumber = (value) => {
    const casesRegexp = /^(?=.*[0-9])/gm;
    if (casesRegexp.test(value)) {
        return undefined;
    }
    return 'Must include at least one number';
};
//# sourceMappingURL=containsNumber.js.map