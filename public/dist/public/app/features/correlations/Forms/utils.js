export const getInputId = (inputName, correlation) => {
    if (!correlation) {
        return inputName;
    }
    return `${inputName}_${correlation.sourceUID}-${correlation.uid}`;
};
//# sourceMappingURL=utils.js.map