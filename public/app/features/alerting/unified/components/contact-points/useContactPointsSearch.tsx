import { uniq } from 'lodash';
import { useMemo } from 'react';

import { fuzzySearch } from '@grafana/data';
import { RECEIVER_META_KEY } from 'app/features/alerting/unified/components/contact-points/constants';
import { type ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';

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

  const nameHits = fuzzySearch(nameHaystack, normalizedSearch);
  const typeHits = fuzzySearch(typeHaystack, normalizedSearch);

  const hits = [...nameHits, ...typeHits];

  return uniq(hits).map((id) => contactPoints[id]) ?? [];
};
