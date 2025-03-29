import { SpanLinkDef } from '../../types';

// TODO: Explain how we determine best link
// TODO: Naming alternative getMostRelevantLinkByAttribute
export const getBestLinkByAttribute = (attribute: string, links: SpanLinkDef[] = []) => {
  // Find the link with the attribute closest to the end of its array
  let bestLinkIndex = -1;
  let smallestDistanceFromEnd = Infinity;

  links.forEach((link, linkIndex) => {
    const resourceAttributes = link.resourceAttributes ?? [];
    const attributeIndex = resourceAttributes.lastIndexOf(attribute);

    // Skip if attribute not found
    if (attributeIndex !== -1) {
      // Calculate distance from end (0 means it's the last element)
      const distanceFromEnd = resourceAttributes.length - 1 - attributeIndex;

      if (distanceFromEnd < smallestDistanceFromEnd) {
        smallestDistanceFromEnd = distanceFromEnd;
        bestLinkIndex = linkIndex;
      }
    }
  });

  // Return the best link or undefined if no links have the attribute
  return bestLinkIndex !== -1 ? links[bestLinkIndex] : undefined;
};

export const getLinksByAttribute = (attribute: string, links: SpanLinkDef[]) => {
  return links.filter((link) => link.resourceAttributes?.includes(attribute));
};
