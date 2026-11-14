import { cx, css } from '@emotion/css';
import { useMergeRefs } from '@floating-ui/react';
import { forwardRef, type HTMLAttributes } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { type IconName } from '../../types/icon';
import { type SkeletonComponent, attachSkeleton } from '../../utils/skeleton';
import { getTagColor, getTagColorsFromName } from '../../utils/tags';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

/**
 * @public
 */
export type OnTagClick = (name: string, event: React.MouseEvent<HTMLElement>) => void;

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Name of the tag to display */
  name: string;
  icon?: IconName;
  /** Use constant color from TAG_COLORS. Using index instead of color directly so we can match other styling.
   * The index wraps around, so a value beyond the number of colors is fine. */
  colorIndex?: number;
  /** Base CSS color for a tonal background and foreground pair. Takes precedence over colorIndex. */
  baseColor?: string;
  onClick?: OnTagClick;
  /** Show a close button. The consumer owns removing the tag. */
  onRemove?: OnTagClick;
  /** Disable both label and remove actions. */
  disabled?: boolean;
}

const TagComponent = forwardRef<HTMLElement, Props>(
  ({ name, onClick, onRemove, disabled, icon, className, colorIndex, baseColor, ...rest }, ref) => {
    const rootRef = useMergeRefs([ref]);
    const theme = useTheme2();
    const styles = getTagStyles(theme, name, colorIndex, baseColor);

    const onTagClick = (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      onClick?.(name, event);
    };

    const classes = cx(
      styles.wrapper,
      {
        [styles.hover]: onClick !== undefined && !disabled,
        [styles.disabled]: disabled,
        [styles.removable]: Boolean(onRemove),
      },
      className
    );

    if (onRemove) {
      const { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...wrapperProps } = rest;
      return (
        <span
          {...(onClick ? wrapperProps : rest)}
          aria-disabled={disabled || rest['aria-disabled']}
          className={classes}
          ref={rootRef}
        >
          {onClick ? (
            <button
              type="button"
              className={styles.labelButton}
              onClick={onTagClick}
              disabled={disabled}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
            >
              {icon && <Icon name={icon} />}
              {name}
            </button>
          ) : (
            <span className={styles.label}>
              {icon && <Icon name={icon} />}
              {name}
            </span>
          )}
          <IconButton
            name="times"
            size="lg"
            aria-label={t('grafana-ui.tags-input.remove', 'Remove tag: {{name}}', { name })}
            disabled={disabled}
            className={styles.remove}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove(name, event);
            }}
          />
        </span>
      );
    }

    return onClick ? (
      <button {...rest} disabled={disabled} className={classes} onClick={onTagClick} ref={rootRef}>
        {icon && <Icon name={icon} />}
        {name}
      </button>
    ) : (
      <span {...rest} aria-disabled={disabled || rest['aria-disabled']} className={classes} ref={rootRef}>
        {icon && <Icon name={icon} />}
        {name}
      </span>
    );
  }
);
TagComponent.displayName = 'Tag';

const TagSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);
  return <Skeleton width={60} height={22} containerClassName={styles.container} {...rootProps} />;
};

/**
 * Used for displaying metadata, for example to add more details to search results. Background and border colors are generated from the tag name.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-tag--docs
 */
export const Tag = attachSkeleton(TagComponent, TagSkeleton);

const getSkeletonStyles = () => ({
  container: css({
    lineHeight: 1,
  }),
});

const getTagStyles = (theme: GrafanaTheme2, name: string, colorIndex?: number, baseColor?: string) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const color = baseColor ?? colorIndex;
  const { background, text } = color === undefined ? getTagColorsFromName(name, theme) : getTagColor(color, theme);
  const label = {
    display: 'inline-flex',
    alignItems: 'center',
    // Preserve the existing 3px gap used by Tag's visual-refresh styles and TagsInput's TagItem.
    gap: '3px',
  };
  return {
    removable: css({ display: 'inline-flex', alignItems: 'center', gap: theme.spacing(0.5) }),
    label: css(label),
    labelButton: css({
      ...label,
      borderRadius: theme.shape.radius.sm,
      '&:focus-visible': getFocusStyles(theme),
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
      '&:disabled': { cursor: 'not-allowed' },
      appearance: 'none',
      border: 'none',
      background: 'transparent',
      padding: 0,
      font: 'inherit',
      color: 'inherit',
    }),
    remove: css({
      color: text,
      margin: 0,
      '&:hover::before': {
        display: 'none',
      },
    }),
    disabled: css({ color: theme.colors.text.disabled, cursor: 'not-allowed' }),
    wrapper: css(
      {
        appearance: 'none',
        borderStyle: 'none',
        fontWeight: theme.typography.fontWeightMedium,
        fontSize: theme.typography.size.sm,
        lineHeight: theme.typography.bodySmall.lineHeight,
        verticalAlign: 'baseline',
        backgroundColor: background,
        color: text,
        whiteSpace: 'pre',
        textShadow: 'none',
        padding: '3px 6px',
        borderRadius: theme.shape.radius.sm,
      },
      visualRefreshEnabled && {
        gap: '3px',
        borderRadius: theme.shape.radius.pill,
        padding: `3px ${theme.spacing.x1}`,
        // needed for the icon/text gap below to take effect
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.fontWeightRegular,
      }
    ),
    hover: css({
      '&:hover': {
        opacity: 0.85,
        cursor: 'pointer',
      },
    }),
  };
};
