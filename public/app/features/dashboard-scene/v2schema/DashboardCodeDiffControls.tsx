import { css } from '@emotion/css';
import { diffLines } from 'diff';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineSwitch, Tooltip, useStyles2 } from '@grafana/ui';
import { InlineDiffToggle } from 'app/core/components/MonacoDiffEditor/inlineDiffPreference';

interface Props {
  showDiff: boolean;
  onShowDiffChange: (value: boolean) => void;
  canShowDiff: boolean;
  inlineDiff: boolean;
  onInlineDiffChange: (value: boolean) => void;
  original?: string;
  modified?: string;
}

export function DashboardCodeDiffControls({
  showDiff,
  onShowDiffChange,
  canShowDiff,
  inlineDiff,
  onInlineDiffChange,
  original,
  modified,
}: Props) {
  const styles = useStyles2(getStyles);
  const lineCounts = useMemo(() => {
    if (!showDiff || !canShowDiff || original === undefined || modified === undefined) {
      return undefined;
    }
    // Bound the work for very large or entirely replaced dashboards.
    const changes = diffLines(original, modified, { timeout: 50 });
    return changes?.reduce(
      (counts, change) => ({
        added: counts.added + (change.added ? change.count : 0),
        removed: counts.removed + (change.removed ? change.count : 0),
      }),
      { added: 0, removed: 0 }
    );
  }, [showDiff, canShowDiff, original, modified]);

  return (
    <>
      <Tooltip
        content={t('dashboard.sidebar.edit-schema.diff-disabled-tooltip', 'Fix syntax errors to view the diff')}
        placement="top"
        show={canShowDiff ? false : undefined}
      >
        <div>
          <InlineSwitch
            label={t('dashboard.sidebar.edit-schema.diff-toggle', 'Show diff')}
            showLabel
            value={showDiff}
            disabled={!canShowDiff}
            onChange={(event) => onShowDiffChange(event.currentTarget.checked)}
          />
        </div>
      </Tooltip>
      {showDiff && <InlineDiffToggle value={inlineDiff} onChange={onInlineDiffChange} />}
      {showDiff && lineCounts && (
        <span
          className={styles.lineCounts}
          role="status"
          aria-label={t(
            'dashboard.modes.code.diff-counts',
            '{{added}} lines added, {{removed}} lines removed',
            lineCounts
          )}
        >
          <span className={styles.added}>+{lineCounts.added}</span>
          <span className={styles.removed}>-{lineCounts.removed}</span>
        </span>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  lineCounts: css({
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs, 4px)',
    fontFamily: `var(--typography-font-family-ui, ${theme.typography.fontFamily})`,
    fontSize: 'var(--typography-font-size-ui-sm, 12px)',
    lineHeight: '16px',
    fontWeight: 'var(--typography-font-weight-medium, 500)',
    fontVariantNumeric: 'tabular-nums',
  }),
  // Match Assistant's Undo turn counters even when its design tokens are not loaded.
  added: css({
    color: theme.isDark
      ? 'var(--color-green-400, oklch(79.2% 0.1129 151.71))'
      : 'var(--color-green-700, oklch(52.7% 0.1029 150.07))',
  }),
  removed: css({
    color: theme.isDark
      ? 'var(--color-red-400, oklch(70.4% 0.1104 22.216))'
      : 'var(--color-red-700, oklch(50.5% 0.1133 27.518))',
  }),
});
