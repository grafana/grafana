import { css } from '@emotion/css';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { IconButton } from '../IconButton/IconButton';

interface ValuePillProps {
  children: string;
  onRemove: () => void;
}

export const ValuePill = forwardRef<HTMLSpanElement, ValuePillProps>(({ children, onRemove, ...rest }, ref) => {
  const styles = useStyles2(getValuePillStyles);
  return (
    <span className={styles.wrapper} {...rest} ref={ref}>
      {children}
      <span className={styles.separator} />
      <IconButton
        name="times"
        size="md"
        aria-label={`Remove ${children}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </span>
  );
});

const getValuePillStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    background: theme.colors.background.secondary,
    padding: theme.spacing(0.25),
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  separator: css({
    background: theme.colors.border.weak,
    width: '2px',
    marginLeft: theme.spacing(0.25),
    height: '100%',
  }),
});
