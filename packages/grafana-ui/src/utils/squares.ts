/**
 * This function will calculate how many squares we can fit inside a rectangle.
 * Please have a look at this post for more details about the implementation:
 * https://math.stackexchange.com/questions/466198/algorithm-to-get-the-maximum-size-of-n-squares-that-fit-into-a-rectangle-with-a
 *
 * @param parentWidth width of the parent container
 * @param parentHeight height of the parent container
 * @param numberOfChildren number of children that should fit in the parent container
 * @param childSpacing amount of spacing for each child
 */
export const calculatePreferredSizeForChild = (
  parentWidth: number,
  parentHeight: number,
  numberOfChildren: number,
  childSpacing: number
): number => {
  const spacing = childSpacing * numberOfChildren;
  const width = parentWidth - spacing;

  const vertical = calculateSizeOfChild(width, parentHeight, numberOfChildren);
  const horizontal = calculateSizeOfChild(parentHeight, width, numberOfChildren);

  return Math.max(vertical, horizontal);
};

function calculateSizeOfChild(parentWidth: number, parentHeight: number, numberOfChildren: number): number {
  const parts = Math.ceil(Math.sqrt((numberOfChildren * parentWidth) / parentHeight));

  if (Math.floor((parts * parentHeight) / parentWidth) * parts < numberOfChildren) {
    return parentHeight / Math.ceil((parts * parentHeight) / parentWidth);
  }

  return parentWidth / parts;
}
