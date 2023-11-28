export const capitalizeText = (text) => {
    if (!text.length) {
        return '';
    }
    if (text.length === 1) {
        return text.toUpperCase();
    }
    return `${text[0].toUpperCase()}${text.substring(1).toLowerCase()}`;
};
//# sourceMappingURL=capitalizeText.js.map