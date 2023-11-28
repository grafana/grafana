/**
 * Truncate a long string by appending ... at the and
 */
export const truncate = (length = 30) => (str = '') => {
    if (typeof str !== 'string') {
        return str;
    }
    return `${str.substr(0, length - 3)}...`;
};
//# sourceMappingURL=truncate.js.map