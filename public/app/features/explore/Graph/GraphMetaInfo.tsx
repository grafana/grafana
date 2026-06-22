import { type DataFrame, formattedValueToString, getValueFormat } from '@grafana/data';
import { t } from '@grafana/i18n';

import { MetaInfoText } from '../MetaInfoText';

// Display name set by the Prometheus/Mimir backend (promlib) for the
// equivalent-samples-read query stat parsed from the Server-Timing header.
// Matched literally because the backend attaches the stat without tagging a headline.
const EQUIVALENT_SAMPLES_READ_STAT = 'Equivalent samples read';

interface Props {
  data: DataFrame[];
}

export function GraphMetaInfo({ data }: Props) {
  let totalSamples = 0;
  let unit = 'short';
  const queriesVisited: Record<string, boolean> = {};

  for (const frame of data) {
    const { refId } = frame; // Stats are per query, keeping track by refId
    if (refId && !queriesVisited[refId]) {
      const stat = frame.meta?.stats?.find((s) => s.displayName === EQUIVALENT_SAMPLES_READ_STAT);
      if (stat) {
        totalSamples += stat.value;
        if (stat.unit) {
          unit = stat.unit;
        }
      }
      queriesVisited[refId] = true;
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
