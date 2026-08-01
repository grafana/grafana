import uFuzzy from '@leeoniya/ufuzzy';
import { uniq } from 'lodash';
import { useMemo } from 'react';

import { RECEIVER_META_KEY } from 'app/features/alerting/unified/components/contact-points/constants';
import { type ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';

const LONG_QUERY_LENGTH_THRESHOLD = 40;

const fuzzyFinder = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraDel: 1,
  intraTrn: 1,
});

// let's search in two different haystacks, the name of the contact point and the type of the receiver(s)
export const useContactPointsSearch = (
  contactPoints: ContactPointWithMetadata[],
  search?: string | null
): ContactPointWithMetadata[] => {
  const normalizedSearch = search?.trim();

  const nameHaystack = useMemo(() => {
    return contactPoints.map((contactPoint) => contactPoint.name);
  }, [contactPoints]);

  const typeHaystack = useMemo(() => {
    return contactPoints.map((contactPoint) =>
      // we're using the resolved metadata key here instead of the "type" property – ex. we alias "teams" to "microsoft teams"
      contactPoint.grafana_managed_receiver_configs.map((receiver) => receiver[RECEIVER_META_KEY].name).join(' ')
    );
  }, [contactPoints]);

  if (!normalizedSearch) {
    return contactPoints;
  }

  // Long, separator-heavy queries can trigger expensive regex backtracking in fuzzy matching.
  // For these cases, use a deterministic contains check to keep typing responsive.
  if (normalizedSearch.length >= LONG_QUERY_LENGTH_THRESHOLD) {
    const lowerSearch = normalizedSearch.toLocaleLowerCase();

    const hits = contactPoints
      .map((contactPoint, index) => ({ contactPoint, index }))
      .filter(({ contactPoint }) => {
        const nameMatch = contactPoint.name.toLocaleLowerCase().includes(lowerSearch);
        const typeMatch = contactPoint.grafana_managed_receiver_configs
          .some((receiver) => receiver[RECEIVER_META_KEY].name.toLocaleLowerCase().includes(lowerSearch));

        return nameMatch || typeMatch;
      })
      .map(({ index }) => index);

    return hits.map((id) => contactPoints[id]);
  }

  const nameHits = fuzzyFinder.filter(nameHaystack, normalizedSearch) ?? [];
  const typeHits = fuzzyFinder.filter(typeHaystack, normalizedSearch) ?? [];

  const hits = [...nameHits, ...typeHits];

  return uniq(hits).map((id) => contactPoints[id]) ?? [];
};
