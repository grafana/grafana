import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

interface KeyboardHintsProps {
  showBack: boolean;
  showFacetShortcuts: boolean;
  facetShortcutRange?: string;
  showSelect: boolean;
}

export function KeyboardHints({ showBack, showFacetShortcuts, facetShortcutRange, showSelect }: KeyboardHintsProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.hints}>
        {showBack && (
          <span className={styles.hint}>
            <kbd className={styles.kbd}>
              <Trans i18nKey="command-palette.keyboard-hints.esc">ESC</Trans>
            </kbd>
            <span>
              <Trans i18nKey="command-palette.keyboard-hints.back">Back</Trans>
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
      borderTop: '1px solid rgba(83, 83, 85, 0.5)',
      padding: theme.spacing(0.75, 2),
    }),
    hints: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(1.5),
    }),
    hint: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    kbd: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '22px',
      height: '20px',
      padding: '0 4px',
      fontSize: '11px',
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
  };
}
