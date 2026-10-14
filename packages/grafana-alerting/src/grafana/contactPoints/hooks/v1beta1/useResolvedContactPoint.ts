import { useListContactPoints } from './useContactPoints';

export interface ResolvedContactPoint {
  /** The value `ContactPointSelector` expects: the contact point's uid, or its title when it has none. */
  selectorValue: string | null;
  /** The list loaded and no contact point has this receiver's title - e.g. it was deleted. */
  isNotFound: boolean;
  isError: boolean;
}

/** Finds the contact point for a rule's `receiver`. A receiver is the contact point's *title*, while
 * `ContactPointSelector` options are keyed by uid-or-title, so a titled receiver is matched by title. */
export function useResolvedContactPoint(receiver?: string): ResolvedContactPoint {
  const { currentData, isError } = useListContactPoints({}, { refetchOnFocus: true, refetchOnMountOrArgChange: true });

  const contactPoint = receiver ? currentData?.items?.find((cp) => cp.spec.title === receiver) : undefined;
  const selectorValue = contactPoint ? (contactPoint.metadata.uid ?? contactPoint.spec.title) : null;

  const isNotFound = Boolean(receiver) && Boolean(currentData) && !contactPoint;

  // A refetch that fails keeps the last good list, which is still a valid answer.
  return { selectorValue, isNotFound, isError: isError && !currentData };
}
