export const lessThan = (min) => (value) => {
    const num = parseInt(value, 10);
    if (Number.isFinite(num) && num < min) {
        return undefined;
    }
    return `Must be a number less than ${min}`;
};
//# sourceMappingURL=lessThan.js.map