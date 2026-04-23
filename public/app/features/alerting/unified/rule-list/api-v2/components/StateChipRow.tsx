import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, useStyles2 } from '@grafana/ui';

import { type StateChipCounts, type StateChip as StateChipKind } from '../lib/types';

import { StateChip } from './StateChip';

interface Props {
  counts: StateChipCounts;
  active: Set<StateChipKind>;
  onToggle: (chip: StateChipKind) => void;
}

const CHIPS: StateChipKind[] = ['firing', 'pending', 'recovering', 'normal'];

export function StateChipRow({ counts, active, onToggle }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      <span className={styles.label}>
        <Trans i18nKey="alerting.rule-list-v2.state-label">STATE</Trans>
      </span>
      <Stack direction="row" gap={0.5}>
        {CHIPS.map((chip) => (
          <StateChip
            key={chip}
            kind={chip}
            count={counts[chip]}
            active={active.has(chip)}
            onToggle={() => onToggle(chip)}
          />
        ))}
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0),
    }),
    label: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      letterSpacing: '0.05em',
    }),
  };
}
