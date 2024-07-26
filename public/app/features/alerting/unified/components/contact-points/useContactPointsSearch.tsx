import uFuzzy from '@leeoniya/ufuzzy';
import { uniq } from 'lodash';
import { useMemo } from 'react';

import { RECEIVER_META_KEY } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';

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
  const nameHaystack = useMemo(() => {
    return contactPoints.map((contactPoint) => contactPoint.name);
  }, [contactPoints]);

  const typeHaystack = useMemo(() => {
    return contactPoints.map((contactPoint) =>
      // we're using the resolved metadata key here instead of the "type" property – ex. we alias "teams" to "microsoft teams"
      contactPoint.grafana_managed_receiver_configs.map((receiver) => receiver[RECEIVER_META_KEY].name).join(' ')
    );
  }, [contactPoints]);

  if (!search) {
    return contactPoints;
  }

  const nameHits = fuzzyFinder.filter(nameHaystack, search) ?? [];
  const typeHits = fuzzyFinder.filter(typeHaystack, search) ?? [];

  const hits = [...nameHits, ...typeHits];

  return uniq(hits).map((id) => contactPoints[id]) ?? [];
};
