import { css } from '@emotion/css';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';

interface ValuePillProps {
  children: string;
  onRemove: () => void;
  disabled?: boolean;
}

export const ValuePill = forwardRef<HTMLSpanElement, ValuePillProps>(
  ({ children, onRemove, disabled, ...rest }, ref) => {
    const styles = useStyles2(getValuePillStyles, disabled);
    const removeButtonLabel = t('grafana-ui.value-pill.remove-button', 'Remove {{children}}', { children });
    return (
      <span className={styles.wrapper} {...rest} ref={ref}>
        <span className={styles.text}>{children}</span>
        {!disabled && (
          <>
            <span className={styles.separator} />
            <IconButton
              name="times"
              size="md"
              aria-label={removeButtonLabel}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            />
          </>
        )}
      </span>
    );
  }
);

const getValuePillStyles = (theme: GrafanaTheme2, disabled?: boolean) => ({
  wrapper: css({
    display: 'inline-flex',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    background: theme.colors.background.secondary,
    padding: theme.spacing(0.25),
    border: disabled ? `1px solid ${theme.colors.border.weak}` : 'none',
    fontSize: theme.typography.bodySmall.fontSize,
    flexShrink: 0,
    minWidth: '50px',
    alignItems: 'center',

    '&:first-child:has(+ div)': {
      flexShrink: 1,
    },
  }),

  text: css({
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: theme.spacing(0, 1, 0, 0.75),
  }),

  separator: css({
    background: theme.colors.border.weak,
    width: '2px',
    height: '100%',
    marginRight: theme.spacing(0.5),
  }),
});
