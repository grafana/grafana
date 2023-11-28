export const greaterThan = (min) => (value) => {
    const num = parseInt(value, 10);
    if (Number.isFinite(num) && num > min) {
        return undefined;
    }
    return `Must be a number greater than ${min}`;
};
//# sourceMappingURL=greaterThan.js.map