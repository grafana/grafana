import { useMemo } from 'react';

import { type Label } from '../../matchers/types';
import { type LabelMatchDetails } from '../../matchers/utils';
import { type Route } from '../types';

import { type InstanceMatchResult, matchInstancesToRouteTrees } from './useMatchPolicies';
import { useRoutingTreeLookup } from './useResolvedRoutingTree';

/** The parts of a route a preview shows, so consumers don't depend on the matcher's route shape. */
export type PreviewRoute = Pick<Route, 'matchers' | 'continue' | 'receiver' | 'group_by'>;

export interface PreviewJourneyStep {
  route: PreviewRoute;
  /** Why the parent routed to this step. */
  matchDetails: LabelMatchDetails[];
}

export interface InstancePreview {
  labels: Label[];
  /** The routes the instance ended up in. Empty means nothing matched. */
  matchedRoutes: Array<{
    receiver?: string;
    treeName?: string;
    /** The routes walked from the tree root to this one. */
    matchingJourney: PreviewJourneyStep[];
  }>;
}

export interface NotificationPolicyPreviewResult {
  /** Anything but `found` means the tree couldn't be confirmed, so `results` is empty and shouldn't be read as "no match". */
  status: 'resolving' | 'notFound' | 'error' | 'found';
  /** One result per instance, in order. */
  results: InstancePreview[];
  /** Why the tree list couldn't be loaded. Only set when `status` is `error`. */
  error?: unknown;
}

const NO_RESULTS: InstancePreview[] = [];

/** Previews how the instances route through a tree. An unset name previews the default tree. */
export function useNotificationPolicyPreview(
  routingTreeName: string | undefined,
  instances: Label[][]
): NotificationPolicyPreviewResult {
  const { found, isResolving, isError, error } = useRoutingTreeLookup(routingTreeName);
  const results = useMemo(
    // Expanding a large tree is costly, so don't match until there is something to match.
    () =>
      found && instances.length > 0
        ? matchInstancesToRouteTrees([found], instances).map(toInstancePreview)
        : NO_RESULTS,
    [found, instances]
  );

  if (isError) {
    return { status: 'error', results: NO_RESULTS, error };
  }
  if (isResolving) {
    return { status: 'resolving', results: NO_RESULTS };
  }
  if (!found) {
    return { status: 'notFound', results: NO_RESULTS };
  }

  return { status: 'found', results };
}

function toInstancePreview({ labels, matchedRoutes }: InstanceMatchResult): InstancePreview {
  return {
    labels,
    matchedRoutes: matchedRoutes.map(({ route, routeTree, matchDetails }) => ({
      receiver: route.receiver,
      treeName: routeTree.metadata.name,
      matchingJourney: matchDetails.matchingJourney.map((step) => ({
        route: {
          matchers: step.route.matchers,
          continue: step.route.continue,
          receiver: step.route.receiver,
          group_by: step.route.group_by,
        },
        matchDetails: step.matchDetails,
      })),
    })),
  };
}
