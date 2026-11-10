import { css, cx } from '@emotion/css';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { trackStackedViewToggle } from '../../tracking';
import { useQueryEditorUIContext } from '../QueryEditorContext';

// Distance that collapses the stack into a single centred layer on the exit preview.
const COLLAPSE_OFFSET = 3.5;

export function StackedViewToggle() {
  const styles = useStyles2(getStyles);
  const { stackedMode } = useQueryEditorUIContext();

  const handleToggle = () => {
    if (stackedMode.enabled) {
      trackStackedViewToggle('exit');
      stackedMode.exit();
    } else {
      trackStackedViewToggle('enter');
      stackedMode.enter();
    }
  };

  const tooltip = stackedMode.enabled
    ? t('query-editor-next.header.exit-stacked-view', 'Exit stacked view')
    : t('query-editor-next.header.enter-stacked-view', 'Enter stacked view');

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className={cx(styles.button, { [styles.active]: stackedMode.enabled })}
        onClick={handleToggle}
        aria-label={t('query-editor-next.header.stacked-view', 'Stacked view')}
        aria-pressed={stackedMode.enabled}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path data-layer="top" d="M9 2L16 5.5L9 9L2 5.5Z" />
          <path data-layer="lower" d="M2 9L9 12.5L16 9" />
          <path data-layer="lower" d="M2 12.5L9 16L16 12.5" />
        </svg>
      </button>
    </Tooltip>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const layerTransition = theme.transitions.create(['transform', 'opacity'], {
    duration: 250,
    easing: theme.transitions.easing.easeInOut,
  });

  return {
    button: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: 24,
      height: 24,
      padding: 0,
      border: 'none',
      borderRadius: theme.shape.radius.default,
      background: 'none',
      color: theme.colors.text.secondary,
      cursor: 'pointer',

      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
      '&:focus-visible': getFocusStyles(theme),
    }),
    active: css({
      '&, &:hover': {
        background: colorManipulator.alpha(theme.colors.primary.main, 0.15),
        color: theme.colors.primary.main,
      },
      path: {
        [theme.transitions.handleMotion('no-preference')]: { transition: layerTransition },
      },
      // Hovering the On state previews the single view the click would switch to.
      '&:hover [data-layer="top"]': {
        transform: `translateY(${COLLAPSE_OFFSET}px)`,
      },
      '&:hover [data-layer="lower"]': {
        transform: `translateY(-${COLLAPSE_OFFSET}px)`,
        opacity: 0,
      },
    }),
  };
}
