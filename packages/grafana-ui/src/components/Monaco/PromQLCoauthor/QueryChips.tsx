// Prototype-only: decorative pulse animation is intentional for the demo.
/* eslint-disable @grafana/no-unreduced-motion */
import { css, keyframes } from '@emotion/css';
import { Fragment } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import { COLORS } from './scriptedData';
import { type ChipModel } from './types';

interface Props {
  chips: ChipModel[];
  /** Draw connector arrows between chips (horizontal flow). */
  connectors?: boolean;
}

/**
 * The visual query flow: a row of chips coloured by operator, with optional
 * series-count badges. Ghost chips are dashed + pulsing — unconfirmed AI
 * suggestions. Used by the popover and the flow panel.
 */
export function QueryChips({ chips, connectors = true }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      {chips.map((chip, i) => (
        <Fragment key={`${chip.label}-${i}`}>
          {connectors && i > 0 && <span className={styles.connector} />}
          {chip.ghost ? (
            <span className={styles.ghostChip}>{chip.label}</span>
          ) : (
            <span className={styles.chip}>
              <span className={styles.dot} style={{ background: chip.color }} />
              {chip.label}
              {chip.count && <span className={styles.count}>{chip.count}</span>}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

const ghostPulse = keyframes({
  '0%, 100%': { opacity: 0.55 },
  '50%': { opacity: 1 },
});

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    rowGap: theme.spacing(0.75),
  }),
  connector: css({
    width: 12,
    height: 1,
    background: theme.colors.border.medium,
    flex: 'none',
  }),
  chip: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.5, 0.75),
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
  }),
  ghostChip: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    background: `${COLORS.assistant}26`,
    border: `1px dashed ${COLORS.assistant}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.5, 0.75),
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    color: COLORS.assistant,
    whiteSpace: 'nowrap',
    animation: `${ghostPulse} 2s ease-in-out infinite`,
  }),
  dot: css({
    width: 7,
    height: 7,
    borderRadius: theme.shape.radius.default,
    flex: 'none',
  }),
  count: css({
    fontSize: 9,
    color: theme.colors.text.secondary,
  }),
});
