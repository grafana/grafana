/**
 * This function will calculate how many squares we can fit inside a rectangle.
 * Please have a look at this post for more details about the implementation:
 * https://math.stackexchange.com/questions/466198/algorithm-to-get-the-maximum-size-of-n-squares-that-fit-into-a-rectangle-with-a
 *
 * @param parentWidth width of the parent container
 * @param parentHeight height of the parent container
 * @param numberOfChildren number of children that should fit in the parent container
 */
export var calculateGridDimensions = function (parentWidth, parentHeight, itemSpacing, numberOfChildren) {
    var vertical = calculateSizeOfChild(parentWidth, parentHeight, numberOfChildren);
    var horizontal = calculateSizeOfChild(parentHeight, parentWidth, numberOfChildren);
    var square = Math.max(vertical, horizontal);
    var xCount = Math.floor(parentWidth / square);
    var yCount = Math.ceil(numberOfChildren / xCount);
    // after yCount update xCount to make split between rows more even
    xCount = Math.ceil(numberOfChildren / yCount);
    var itemsOnLastRow = xCount - (xCount * yCount - numberOfChildren);
    var widthOnLastRow = parentWidth / itemsOnLastRow - itemSpacing + itemSpacing / itemsOnLastRow;
    return {
        width: parentWidth / xCount - itemSpacing + itemSpacing / xCount,
        height: parentHeight / yCount - itemSpacing + itemSpacing / yCount,
        widthOnLastRow: widthOnLastRow,
        xCount: xCount,
        yCount: yCount,
    };
};
function calculateSizeOfChild(parentWidth, parentHeight, numberOfChildren) {
    var parts = Math.ceil(Math.sqrt((numberOfChildren * parentWidth) / parentHeight));
    if (Math.floor((parts * parentHeight) / parentWidth) * parts < numberOfChildren) {
        return parentHeight / Math.ceil((parts * parentHeight) / parentWidth);
    }
    return parentWidth / parts;
}
//# sourceMappingURL=squares.js.map