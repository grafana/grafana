import { alertingAPI } from '../../api/v0alpha1/api.gen';
import { Label } from '../../matchers/types';
import { Route } from '../types';
import { computeInheritedTree, findMatchingRoutes } from '../utils';
/**
 * React hook that finds notification policy routes in all routing trees that match the provided labels.
 *
 * This hook queries the routing tree API and processes each tree to:
 * 1. Compute the inherited properties for each node in the tree
 * 2. Find routes within each tree that match the given set of labels
 *
 * @param labels - An array of label objects to match against routes in the routing trees
 * @returns An array of matching routes for each routing tree, where each element contains
 *          the matching routes and information about how they matched the provided labels
 */
export function useFindRoutesMatchingLabels(labels: Label[]): Array<ReturnType<typeof findMatchingRoutes>> {
  const { data, isSuccess } = alertingAPI.endpoints.listRoutingTree.useQuery({});

  // @TODO I hate to type-cast here but RoutingTreeSpec.Routes is not compatible with Route because we've narrowed the types for label matchers :(
  // @ts-expect-error
  const fullTrees = isSuccess ? data.items.map((tree) => computeInheritedTree(tree.spec as Route)) : [];
  return fullTrees.map((tree) => findMatchingRoutes(tree, labels));
}
