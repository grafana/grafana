import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useSceneContext } from '@grafana/scenes-react';
import { Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { COMBINED_FILTER_LABEL_KEYS } from '../../constants';
import { type LabelStats } from '../useLabelsBreakdown';
import { addOrReplaceFilter, removeFilter, useRegexFilterValue } from '../utils';

import { SeverityBars } from './SeverityBars';
import { SEVERITY_DEFINITIONS, type SeverityLevel, canonicalSeverity, severityFilterRegex } from './severity';

interface SeverityCount {
  firing: number;
  pending: number;
}

function useSeverityCounts(labels: LabelStats[]): Map<SeverityLevel, SeverityCount> {
  const severityKeys = COMBINED_FILTER_LABEL_KEYS.severity;
  const counts = new Map<SeverityLevel, SeverityCount>();

  for (const key of severityKeys) {
    const severityStats = labels.find((l) => l.key === key);
    if (!severityStats) {
      continue;
    }

    for (const { value, firing, pending } of severityStats.values) {
      const level = canonicalSeverity(value);
      if (!level) {
        continue;
      }
      const existing = counts.get(level) ?? { firing: 0, pending: 0 };
      counts.set(level, { firing: existing.firing + firing, pending: existing.pending + pending });
    }
  }

  return counts;
}

interface SeverityFilterProps {
  labels: LabelStats[];
}

export function SeverityFilter({ labels }: SeverityFilterProps) {
  const styles = useStyles2(getStyles);
  const sceneContext = useSceneContext();
  const activeValue = useRegexFilterValue('severity');
  const counts = useSeverityCounts(labels);

  const activeLevel = SEVERITY_DEFINITIONS.find((d) => activeValue === severityFilterRegex(d.level))?.level;

  const toggle = (level: SeverityLevel) => {
    const regex = severityFilterRegex(level);
    if (activeLevel === level) {
      removeFilter(sceneContext, 'severity');
    } else {
      addOrReplaceFilter(sceneContext, 'severity', '=~', regex);
    }
  };

  return (
    <Stack direction="column" gap={0.5}>
      {SEVERITY_DEFINITIONS.map((def) => {
        const count = counts.get(def.level);
        return (
          <Tooltip key={def.level} content={def.values.slice(1).join(', ')} placement="right">
            <button
              className={cx(styles.severityButton, activeLevel === def.level && styles.severityButtonActive)}
              onClick={() => toggle(def.level)}
            >
              <SeverityBars level={def.level} />
              <span className={styles.severityLabel}>
                <Trans i18nKey={`alerting.triage.severity-${def.level}`}>{capitalise(def.level)}</Trans>
              </span>
              <span className={styles.severityCount}>{count ? count.firing + count.pending : 0}</span>
            </button>
          </Tooltip>
        );
      })}
    </Stack>
  );
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const getStyles = (theme: GrafanaTheme2) => ({
  severityButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.5, 0.75),
    background: 'none',
    border: `1px solid transparent`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    textAlign: 'left',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  severityButtonActive: css({
    background: theme.colors.action.selected,
  }),
  severityLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  severityCount: css({
    marginLeft: 'auto',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  }),
});
