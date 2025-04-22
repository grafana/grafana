import { SpanLinkDef } from '../../types';

/**
 * Returns the most relevant link for the given attribute.
 * The most relevant link is the link with the attribute closest to the end of its array.
 * The closer to the end of the url the more specific the attribute is.
 */
export const getMostRelevantLinkByAttribute = (attribute: string, links: SpanLinkDef[] = []) => {
  // Find the link with the attribute closest to the end of its array
  let bestLinkIndex = -1;
  let smallestDistanceFromEnd = Infinity;
  // Sort links by the number of resource attributes in descending order
  const sortedLinks = links.sort((a, b) => (b.resourceAttributes ?? []).length - (a.resourceAttributes ?? []).length);

  sortedLinks.forEach((link, linkIndex) => {
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
