/**
 * This function will calculate how many squares we can fit inside a rectangle.
 * Please have a look at this post for more details about the implementation:
 * https://math.stackexchange.com/questions/466198/algorithm-to-get-the-maximum-size-of-n-squares-that-fit-into-a-rectangle-with-a
 *
 * @param parentWidth width of the parent container
 * @param parentHeight height of the parent container
 * @param numberOfChildren number of children that should fit in the parent container
 */
export const calculateGridDimensions = (parentWidth: number, parentHeight: number, numberOfChildren: number) => {
  const vertical = calculateSizeOfChild(parentWidth, parentHeight, numberOfChildren);
  const horizontal = calculateSizeOfChild(parentHeight, parentWidth, numberOfChildren);
  const square = Math.max(vertical, horizontal);
  const xCount = Math.floor(parentWidth / square);
  const yCount = Math.ceil(numberOfChildren / xCount);

  return {
    width: parentWidth / xCount,
    height: parentHeight / yCount,
    xCount,
    yCount,
  };
};

function calculateSizeOfChild(parentWidth: number, parentHeight: number, numberOfChildren: number): number {
  const parts = Math.ceil(Math.sqrt((numberOfChildren * parentWidth) / parentHeight));

  if (Math.floor((parts * parentHeight) / parentWidth) * parts < numberOfChildren) {
    return parentHeight / Math.ceil((parts * parentHeight) / parentWidth);
  }

  return parentWidth / parts;
}
