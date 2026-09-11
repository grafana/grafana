import { type DataFrame, formattedValueToString, getValueFormat } from '@grafana/data';
import { t } from '@grafana/i18n';

import { MetaInfoText } from '../MetaInfoText';

// Display name set by the Prometheus/Mimir backend (promlib) for the
// equivalent-samples-read query stat parsed from the Server-Timing header.
// A query can run as a range, instant, and exemplar request at once, each
// carrying its own stat prefixed with its query type, so all three are
// matched. In practice only range/instant reach `data` here — exemplar
// frames are routed to Explore's annotations, not the series this component
// reads — but matching all three keeps this in step with the backend.
const EQUIVALENT_SAMPLES_READ_STAT = /^(Exemplar|Instant|Range): Equivalent samples read$/;

interface Props {
  data: DataFrame[];
}

export function GraphMetaInfo({ data }: Props) {
  let totalSamples = 0;
  let unit = 'short';
  // Keyed by refId + stat name, since one refId can carry a stat per query type.
  const statsVisited: Record<string, boolean> = {};

  for (const frame of data) {
    const { refId } = frame;
    if (!refId) {
      continue;
    }
    const stat = frame.meta?.stats?.find((s) => EQUIVALENT_SAMPLES_READ_STAT.test(s.displayName ?? ''));
    if (!stat) {
      continue;
    }
    const statKey = `${refId}:${stat.displayName}`;
    if (statsVisited[statKey]) {
      continue;
    }
    statsVisited[statKey] = true;
    totalSamples += stat.value;
    if (stat.unit) {
      unit = stat.unit;
    }
  }

  if (totalSamples <= 0) {
    return null;
  }

  return (
    <MetaInfoText
      metaItems={[
        {
          label: t('graph.meta-info.equivalent-samples-read', 'Equivalent samples read'),
          value: formattedValueToString(getValueFormat(unit)(totalSamples)),
        },
      ]}
    />
  );
}
