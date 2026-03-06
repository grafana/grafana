import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

interface KeyboardHintsProps {
  escAction?: 'close' | 'back';
  showFacetShortcuts: boolean;
  facetShortcutRange?: string;
  showSelect: boolean;
}

export function KeyboardHints({ escAction, showFacetShortcuts, facetShortcutRange, showSelect }: KeyboardHintsProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.hints}>
        {escAction && (
          <span className={styles.hint}>
            <kbd className={styles.kbd}>
              <Trans i18nKey="command-palette.keyboard-hints.esc">ESC</Trans>
            </kbd>
            <span>
              {escAction === 'back' ? (
                <Trans i18nKey="command-palette.keyboard-hints.back">Back</Trans>
              ) : (
                <Trans i18nKey="command-palette.keyboard-hints.close">Close</Trans>
              )}
            </span>
          </span>
        )}
        {showFacetShortcuts && facetShortcutRange && (
          <span className={styles.hint}>
            <kbd className={styles.kbd}>
              <Trans i18nKey="command-palette.keyboard-hints.focus-shortcut" values={{ range: facetShortcutRange }}>
                {'⌘{{ range }}'}
              </Trans>
            </kbd>
            <span>
              <Trans i18nKey="command-palette.keyboard-hints.focus">Focus</Trans>
            </span>
          </span>
        )}
        {showSelect && (
          <span className={styles.hint}>
            <kbd className={styles.kbd}>
              <Trans i18nKey="command-palette.keyboard-hints.enter">↵</Trans>
            </kbd>
            <span>
              <Trans i18nKey="command-palette.keyboard-hints.select">Select</Trans>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      background: 'rgba(42, 48, 55, 0.3)',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1.5, 2),
    }),
    hints: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(2.5),
    }),
    hint: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.primary,
    }),
    kbd: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '22px',
      height: '22px',
      padding: theme.spacing(0, 0.5),
      ...theme.typography.bodySmall,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: 1,
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      background: theme.colors.action.selected,
      border: 'none',
      borderRadius: theme.shape.radius.sm,
    }),
  };
}
