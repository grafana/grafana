import { type ContactPoint } from '../../../api/notifications/v1beta1/types';

import { useListContactPoints } from './useContactPoints';

export interface ResolvedContactPoint {
  contactPoint: ContactPoint | null;
  /** The value `ContactPointSelector` expects: the contact point's uid, or its title when it has none. */
  selectorValue: string | null;
  isLoading: boolean;
  isError: boolean;
}

/** Finds the contact point for a rule's `receiver`. A receiver is the contact point's *title*, while
 * `ContactPointSelector` options are keyed by uid-or-title, so a titled receiver is matched by title. */
export function useResolvedContactPoint(receiver?: string): ResolvedContactPoint {
  const { currentData, isLoading, isError } = useListContactPoints();

  const contactPoint = receiver ? (currentData?.items?.find((cp) => cp.spec.title === receiver) ?? null) : null;
  const selectorValue = contactPoint ? (contactPoint.metadata.uid ?? contactPoint.spec.title) : null;

  return { contactPoint, selectorValue, isLoading, isError };
}
