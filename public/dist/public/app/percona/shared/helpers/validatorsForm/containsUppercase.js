const errorMessage = 'Must include at least one uppercase letter';
const casesRegexp = /^(?=.*[A-Z])/gm;
export const containsUppercase = (value) => {
    if (typeof value !== 'string') {
        return errorMessage;
    }
    if (casesRegexp.test(value)) {
        return undefined;
    }
    return errorMessage;
};
//# sourceMappingURL=containsUppercase.js.map