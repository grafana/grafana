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
  value: string;
  size?: LabelSize;
  onClick?: ([value, key]: [string, string | undefined]) => void;
}

type Props = BaseProps & MergeExclusive<{ color?: string }, { colorBy?: 'key' | 'value' | 'both' }>;

const AlertLabel = (props: Props) => {
  const { labelKey, value, icon, color, size = 'md', onClick, ...rest } = props;
  const theColor = getColorFromProps(props);
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
      {onClick ? (
        <button
          type="button"
          className={styles.clickable}
          key={labelKey + value}
          onClick={() => onClick([value, labelKey])}
        >
          {innerLabel}
        </button>
      ) : (
        innerLabel
      )}
    </div>
  );
};

function getColorFromProps({
  color,
  colorBy,
  labelKey,
  value,
}: Pick<Props, 'color' | 'colorBy' | 'labelKey' | 'value'>) {
  if (color) {
    return getTagColorsFromName(color).color;
  }

  if (colorBy === 'key') {
    return getTagColorsFromName(labelKey).color;
  }

  if (colorBy === 'value') {
    return getTagColorsFromName(value).color;
  }

  if (colorBy === 'both') {
    return getTagColorsFromName(labelKey + value).color;
  }

  return;
}

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
    valueWithoutKey: css({
      borderTopLeftRadius: theme.shape.borderRadius(2),
      borderBottomLeftRadius: theme.shape.borderRadius(2),
      borderLeft: `solid 1px ${borderColor}`,
    }),
  };
};

export { AlertLabel };
export type AlertLabelProps = Props;
