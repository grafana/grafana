// This needs to be in its own file to avoid circular references

/**
 * Ids of the built in item matchers. Stored in dashboard JSON as `matcher.id`.
 *
 * @alpha
 */
export enum ItemMatcherID {
  byItemIds = 'byItemIds',
  byItemRegexp = 'byItemRegexp',
  allItems = 'allItems',
}
