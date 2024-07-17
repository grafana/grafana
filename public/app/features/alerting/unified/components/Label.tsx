import { css } from '@emotion/css';
import { CSSProperties, ReactNode, useMemo } from 'react';
import tinycolor2 from 'tinycolor2';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

export type LabelSize = 'md' | 'sm' | 'xs';

interface Props {
  icon?: IconName;
  label?: ReactNode;
  value: ReactNode;
  color?: string;
  size?: LabelSize;
  onClick?: (label: string, value: string) => void;
}

// TODO allow customization with color prop
const Label = ({ label, value, icon, color, size = 'md', onClick }: Props) => {
  const styles = useStyles2(getStyles, color, size);
  const ariaLabel = `${label}: ${value}`;
  const labelStr = label?.toString() ?? '';
  const valueStr = value?.toString() ?? '';

  const innerLabel = useMemo(
    () => (
      <Stack direction="row" gap={0} alignItems="stretch">
        <div className={styles.label}>
          <Stack direction="row" gap={0.5} alignItems="center">
            {icon && <Icon name={icon} />}
            {label && (
              <span className={styles.labelText} title={label.toString()}>
                {label ?? ''}
              </span>
            )}
          </Stack>
        </div>
        <div className={styles.value} title={value?.toString()}>
          {value ?? '-'}
        </div>
      </Stack>
    ),
    [icon, label, value, styles]
  );

  return (
    <div className={styles.wrapper} role="listitem" aria-label={ariaLabel} data-testid="label-value">
      {onClick ? (
        <div
          className={styles.clickable}
          role="button" // role="button" and tabIndex={0} is needed for keyboard navigation
          tabIndex={0} // Make it focusable
          key={labelStr + valueStr}
          onClick={() => onClick(labelStr, valueStr)}
          onKeyDown={(e) => {
            // needed for accessiblity: handle keyboard navigation
            if (e.key === 'Enter') {
              onClick(labelStr, valueStr);
              e.preventDefault();
            }
          }}
        >
          {innerLabel}
        </div>
      ) : (
        innerLabel
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, color?: string, size?: string) => {
  const backgroundColor = color ?? theme.colors.secondary.main;

  const borderColor = theme.isDark
    ? tinycolor2(backgroundColor).lighten(5).toString()
    : tinycolor2(backgroundColor).darken(5).toString();

  const valueBackgroundColor = theme.isDark
    ? tinycolor2(backgroundColor).darken(5).toString()
    : tinycolor2(backgroundColor).lighten(5).toString();

  const fontColor = color
    ? tinycolor2.mostReadable(backgroundColor, ['#000', '#fff']).toString()
    : theme.colors.text.primary;

  let padding: CSSProperties['padding'] = theme.spacing(0.33, 1);

  switch (size) {
    case 'sm':
      padding = theme.spacing(0.2, 0.6);
      break;
    case 'xs':
      padding = theme.spacing(0, 0.5);
      break;
    default:
      break;
  }

  return {
    wrapper: css({
      color: fontColor,
      fontSize: theme.typography.bodySmall.fontSize,

      borderRadius: theme.shape.borderRadius(2),
    }),
    labelText: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '300px',
    }),
    label: css({
      display: 'flex',
      alignItems: 'center',
      color: 'inherit',

      padding: padding,
      background: backgroundColor,

      border: `solid 1px ${borderColor}`,
      borderTopLeftRadius: theme.shape.borderRadius(2),
      borderBottomLeftRadius: theme.shape.borderRadius(2),
    }),
    clickable: css({
      '&:hover': {
        opacity: 0.8,
        cursor: 'pointer',
      },
    }),
    value: css({
      color: 'inherit',
      padding: padding,
      background: valueBackgroundColor,
      border: `solid 1px ${borderColor}`,
      borderLeft: 'none',
      borderTopRightRadius: theme.shape.borderRadius(2),
      borderBottomRightRadius: theme.shape.borderRadius(2),
      whiteSpace: 'pre',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '300px',
    }),
  };
};

export { Label };
