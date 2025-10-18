import { css, cx } from '@emotion/css';
import { CSSProperties, HTMLAttributes, useMemo } from 'react';
import tinycolor2 from 'tinycolor2';
import { MergeExclusive } from 'type-fest';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Stack, getTagColorsFromName, useStyles2 } from '@grafana/ui';

export type LabelSize = 'md' | 'sm' | 'xs';

interface BaseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick' | 'className'> {
  icon?: IconName;
  labelKey?: string;
  value?: string;
  size?: LabelSize;
  onClick?: ([value, key]: [string | undefined, string | undefined]) => void;
}

type Props = BaseProps & MergeExclusive<{ color?: string }, { colorBy?: 'key' | 'value' | 'both' }>;

const AlertLabel = (props: Props) => {
  const { labelKey, value, icon, color, colorBy, size = 'md', onClick, ...rest } = props;
  const theColor = getColorFromProps({ color, colorBy, labelKey, value });
  const styles = useStyles2(getStyles, theColor, size);

  const ariaLabel = `${labelKey}: ${value}`;
  const keyless = !Boolean(labelKey);

  const innerLabel = useMemo(
    () => (
      <Stack direction="row" gap={0} alignItems="stretch">
        {labelKey && (
          <div className={styles.label}>
            <Stack direction="row" gap={0.5} alignItems="center">
              {icon && <Icon name={icon} />}
              {labelKey && (
                <span className={styles.labelText} title={labelKey.toString()}>
                  {labelKey ?? ''}
                </span>
              )}
            </Stack>
          </div>
        )}
        <div className={cx(styles.value, keyless && styles.valueWithoutKey)} title={value?.toString()}>
          {value ?? '-'}
        </div>
      </Stack>
    ),
    [labelKey, styles.label, styles.labelText, styles.value, styles.valueWithoutKey, icon, keyless, value]
  );

  return (
    <div className={styles.wrapper} aria-label={ariaLabel} data-testid="label-value" {...rest}>
      {onClick && (labelKey || value) ? (
        <button
          type="button"
          className={styles.clickable}
          key={`${labelKey ?? ''}${value ?? ''}`}
          onClick={() => onClick?.([value ?? '', labelKey ?? ''])}
        >
          {innerLabel}
        </button>
      ) : (
        innerLabel
      )}
    </div>
  );
};

function getAccessibleTagColor(name?: string): string | undefined {
  if (!name) {
    return;
  }
  const attempts = Array.from({ length: 6 }, (_, i) => name + '-'.repeat(i));
  const readableAttempt = attempts.find((attempt) => {
    const candidate = getTagColorsFromName(attempt).color;
    return (
      tinycolor2.isReadable(candidate, '#000', { level: 'AA', size: 'small' }) ||
      tinycolor2.isReadable(candidate, '#fff', { level: 'AA', size: 'small' })
    );
  });
  const chosen = readableAttempt ?? name;
  return getTagColorsFromName(chosen).color;
}

function getColorFromProps({
  color,
  colorBy,
  labelKey,
  value,
}: Pick<Props, 'color' | 'colorBy' | 'labelKey' | 'value'>) {
  if (color) {
    return getAccessibleTagColor(color);
  }

  if (colorBy === 'key') {
    return getAccessibleTagColor(labelKey);
  }

  if (colorBy === 'value') {
    return getAccessibleTagColor(value);
  }

  if (colorBy === 'both' && labelKey && value) {
    return getAccessibleTagColor(labelKey + value);
  }

  return;
}

function getReadableFontColor(bg: string, fallback: string): string {
  // First: explicitly check black
  if (tinycolor2.isReadable(bg, '#000', { level: 'AA', size: 'small' })) {
    return '#000';
  }

  // Then: explicitly check white
  if (tinycolor2.isReadable(bg, '#fff', { level: 'AA', size: 'small' })) {
    return '#fff';
  }

  // Then: try fallback if it’s readable
  if (tinycolor2.isReadable(bg, fallback, { level: 'AA', size: 'small' })) {
    return tinycolor2(fallback).toHexString();
  }

  // Last resort: pick the "most readable", even if not AA-compliant
  return tinycolor2
    .mostReadable(bg, ['#000', '#fff', fallback], {
      includeFallbackColors: true,
    })
    .toHexString();
}

const getStyles = (theme: GrafanaTheme2, color?: string, size?: string) => {
  const backgroundColor = color ?? theme.colors.secondary.main;

  const borderColor = theme.isDark
    ? tinycolor2(backgroundColor).lighten(5).toString()
    : tinycolor2(backgroundColor).darken(5).toString();

  const valueBackgroundColor = theme.isDark
    ? tinycolor2(backgroundColor).darken(5).toString()
    : tinycolor2(backgroundColor).lighten(5).toString();

  const labelFontColor = color
    ? getReadableFontColor(backgroundColor, theme.colors.text.primary)
    : theme.colors.text.primary;

  const valueFontColor = color
    ? getReadableFontColor(valueBackgroundColor, theme.colors.text.primary)
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
      color: labelFontColor,

      padding: padding,
      background: backgroundColor,

      border: `solid 1px ${borderColor}`,
      borderTopLeftRadius: theme.shape.borderRadius(2),
      borderBottomLeftRadius: theme.shape.borderRadius(2),
    }),
    clickable: css({
      border: 'none',
      background: 'none',
      outline: 'none',
      boxShadow: 'none',

      padding: 0,
      margin: 0,

      '&:hover': {
        opacity: 0.8,
        cursor: 'pointer',
      },
    }),
    value: css({
      color: valueFontColor,
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
    valueWithoutKey: css({
      borderTopLeftRadius: theme.shape.borderRadius(2),
      borderBottomLeftRadius: theme.shape.borderRadius(2),
      borderLeft: `solid 1px ${borderColor}`,
    }),
  };
};

export { AlertLabel };
export type AlertLabelProps = Props;
