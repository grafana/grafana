import { css } from '@emotion/css';
import { forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';

import { getMultiComboboxInnerHeight } from './getMultiComboboxStyles';

interface ValuePillProps {
  children: string;
  onRemove: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const ValuePill = forwardRef<HTMLSpanElement, ValuePillProps>(
  ({ children, onRemove, disabled, size = 'md', ...rest }, ref) => {
    const styles = useStyles2(getValuePillStyles, disabled, size);
    const removeButtonLabel = t('grafana-ui.value-pill.remove-button', 'Remove {{children}}', { children });
    return (
      <span className={styles.wrapper} {...rest} ref={ref}>
        <span className={styles.text}>{children}</span>
        {!disabled && (
          <>
            <span className={styles.separator} />
            <IconButton
              name="times"
              size="sm"
              aria-label={removeButtonLabel}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
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
ValuePill.displayName = 'ValuePill';

const getValuePillStyles = (theme: GrafanaTheme2, disabled: boolean | undefined, size: 'sm' | 'md') => ({
  wrapper: css({
    display: 'inline-flex',
    borderRadius: theme.shape.radius.sm,
    color: theme.colors.text.primary,
    background: theme.colors.background.secondary,
    height: getMultiComboboxInnerHeight(theme, size),
    padding: theme.spacing(0.25),
    border: disabled ? `1px solid ${theme.colors.border.weak}` : 'none',
    fontSize: theme.typography.bodySmall.fontSize,
    flexShrink: 1,
    minWidth: '50px',
    alignItems: 'center',
  }),

  text: css({
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: theme.spacing(0, 1, 0, 0.75),
  }),

  separator: css({
    background: theme.colors.border.weak,
    width: '1px',
    height: '100%',
    marginRight: theme.spacing(0.5),
  }),
});
