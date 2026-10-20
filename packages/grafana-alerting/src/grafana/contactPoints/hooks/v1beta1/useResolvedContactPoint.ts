import { isUsableContactPoint } from '../../utils';

import { useListContactPoints } from './useContactPoints';

type ContactPointStatus =
  | 'unset'
  | 'resolving'
  | 'found'
  | 'notFound'
  /** The contact point exists but can't be used in rules, e.g. it was imported from an external Alertmanager. */
  | 'unusable'
  | 'error';

export interface ResolvedContactPoint {
  status: ContactPointStatus;
  /** The value `ContactPointSelector` expects: the contact point's uid, or its title when it has none.
   * Only set when `status` is `found`, because the selector doesn't list unusable contact points. */
  selectorValue: string | null;
}

/** Finds the contact point for a rule's `receiver`. A receiver is the contact point's *title*, while
 * `ContactPointSelector` options are keyed by uid-or-title, so a titled receiver is matched by title. */
export function useResolvedContactPoint(receiver?: string): ResolvedContactPoint {
  const { currentData, isError } = useListContactPoints({}, { refetchOnFocus: true, refetchOnMountOrArgChange: true });

  // A refetch that fails keeps the last good list, which is still a valid answer.
  if (isError && !currentData) {
    return { status: 'error', selectorValue: null };
  }
  if (!receiver) {
    return { status: 'unset', selectorValue: null };
  }
  if (!currentData) {
    return { status: 'resolving', selectorValue: null };
  }

  const contactPoint = currentData.items?.find((cp) => cp.spec.title === receiver);
  if (!contactPoint) {
    return { status: 'notFound', selectorValue: null };
  }
  if (!isUsableContactPoint(contactPoint)) {
    return { status: 'unusable', selectorValue: null };
  }
  return { status: 'found', selectorValue: contactPoint.metadata.uid ?? contactPoint.spec.title };
}
