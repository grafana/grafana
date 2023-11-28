export const validateIntervalRegex = /^(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])$/;
export const validateInterval = (val, regex) => {
    const matches = val.match(regex);
    return matches || !val ? false : true;
};
//# sourceMappingURL=validation.js.map