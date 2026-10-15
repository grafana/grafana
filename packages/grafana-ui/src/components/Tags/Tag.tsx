import { cx, css } from '@emotion/css';
import { forwardRef, type HTMLAttributes } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
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
  onClick?: OnTagClick;
  /** Show a trailing close button. Disabled when onClose is not provided. */
  showCloseButton?: boolean;
  /** Requests removal; the parent controls whether the tag remains rendered. */
  onClose?: OnTagClick;
  /** Accessible label for the close button. Defaults to "Remove tag: <name>". */
  closeButtonLabel?: string;
}

const TagComponent = forwardRef<HTMLElement, Props>(
  (
    { name, onClick, icon, className, colorIndex, showCloseButton = false, onClose, closeButtonLabel, ...rest },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getTagStyles(theme, name, colorIndex);

    const onTagClick = (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      onClick?.(name, event);
    };

    const classes = cx(styles.wrapper, className, { [styles.hover]: onClick !== undefined });

    if (showCloseButton) {
      const content = (
        <>
          {icon && <Icon name={icon} />}
          {name}
        </>
      );
      return (
        <span {...rest} className={cx(styles.wrapper, styles.closable, className)} ref={ref}>
          {onClick ? (
            <button
              type="button"
              className={cx(styles.contentButton, styles.hover)}
              onClick={onTagClick}
              aria-label={rest['aria-label']}
            >
              {content}
            </button>
          ) : (
            content
          )}
          <IconButton
            name="times"
            size="sm"
            className={styles.closeButton}
            aria-label={closeButtonLabel ?? t('grafana-ui.tag.remove', 'Remove tag: {{name}}', { name })}
            disabled={!onClose}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose?.(name, event);
            }}
          />
        </span>
      );
    }

    return onClick ? (
      <button {...rest} className={classes} onClick={onTagClick} ref={ref as React.ForwardedRef<HTMLButtonElement>}>
        {icon && <Icon name={icon} />}
        {name}
      </button>
    ) : (
      <span {...rest} className={classes} ref={ref}>
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

const getTagStyles = (theme: GrafanaTheme2, name: string, colorIndex?: number) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const { background, text } =
    colorIndex === undefined ? getTagColorsFromName(name, theme) : getTagColor(colorIndex, theme);
  return {
    closable: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    contentButton: css({
      appearance: 'none',
      border: 0,
      padding: 0,
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    closeButton: css({
      margin: 0,
      color: 'inherit',
    }),
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
