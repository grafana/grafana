export const arrayMove = (array, fromIndex, toIndex) => {
    array.splice(toIndex, 0, array.splice(fromIndex, 1)[0]);
    return array;
};
//# sourceMappingURL=arrayMove.js.map