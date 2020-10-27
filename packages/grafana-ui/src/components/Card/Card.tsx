import React, { cloneElement, FC, HTMLAttributes, ReactElement, ReactNode, useCallback, useMemo } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, styleMixins, stylesFactory } from '../../themes';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';
import { OnTagClick } from '../Tags/Tag';
import { TagList } from '../Tags/TagList';

/**
 * @alpha
 */
export interface ContainerProps extends HTMLAttributes<HTMLOrSVGElement> {
  /** Content for the card's tooltip */
  tooltip?: PopoverContent;
}

const CardContainer: FC<ContainerProps> = ({ children, tooltip, ...props }) => {
  return tooltip ? (
    <Tooltip placement="top" content={tooltip} theme="info">
      <div {...props}>{children}</div>
    </Tooltip>
  ) : (
    <div {...props}>{children}</div>
  );
};

/**
 * @alpha
 */
export interface CardInnerProps {
  href?: string;
}

const CardInner: FC<CardInnerProps> = ({ children, href }) => {
  const theme = useTheme();
  const styles = getCardStyles(theme);
  return href ? (
    <a className={styles.innerLink} href={href}>
      {children}
    </a>
  ) : (
    <>{children}</>
  );
};

/**
 * @alpha
 */
export interface Props extends ContainerProps {
  /** Main heading for the Card **/
  heading: ReactNode;
  /** Additional data about the card. If array is supplied, elements will be rendered with vertical line separator */
  metadata?: ReactNode | ReactNode[];
  /** Card description text */
  description?: string;
  /** List of tags to display in the card */
  tags?: string[];
  /** Optional callback for tag onclick event */
  onTagClick?: OnTagClick;
  /** Indicates if the card and all its actions can be interacted with */
  disabled?: boolean;
  /** Image or icon to be displayed on the let side of the card */
  image?: ReactNode;
  /** Main card actions **/
  actions?: ReactElement[];
  /** Right-side actions */
  secondaryActions?: ReactElement[];
  /** Link to redirect to on card click. If provided, the Card inner content will be rendered inside `a` */
  href?: string;
  /** On click handler for the Card */
  onClick?: () => void;
}

/**
 * Generic card component
 *
 * @alpha
 */
export const Card: FC<Props> = ({
  heading,
  description,
  metadata,
  tags = [],
  onTagClick,
  disabled,
  image,
  actions = [],
  tooltip,
  secondaryActions = [],
  href,
  onClick,
  className,
  ...htmlProps
}) => {
  const hasActions = Boolean(actions.length || secondaryActions.length);
  const disableHover = disabled || actions.length > 1 || !onClick;
  const disableEvents = disabled && !actions.length;
  const theme = useTheme();
  const styles = getCardStyles(theme, disableEvents, disableHover);
  // Join meta data elements by '|'
  const meta = useMemo(
    () =>
      Array.isArray(metadata)
        ? (metadata as ReactNode[]).filter(Boolean).reduce((prev, curr, i) => [
            prev,
            <span key={`separator_${i}`} className={styles.separator}>
              |
            </span>,
            curr,
          ])
        : metadata,
    [metadata, styles.separator]
  );
  const onCardClick = useCallback(() => (disableHover ? () => {} : onClick), [disableHover, onClick]);

  return (
    <CardContainer
      tooltip={tooltip}
      tabIndex={disableHover ? undefined : 0}
      className={cx(styles.container, className)}
      onClick={onCardClick}
      {...htmlProps}
    >
      <CardInner href={href}>
        {image && <div className={styles.media}>{image}</div>}
        <div className={styles.inner}>
          <div className={styles.heading}>{heading}</div>
          {meta && <div className={styles.metadata}>{meta}</div>}
          {!!tags.length && <TagList tags={tags} onClick={onTagClick} className={styles.tagList} />}
          {description && <p className={styles.description}>{description}</p>}
          {hasActions && (
            <div className={styles.actionRow}>
              {!!actions.length && (
                <div className={styles.actions}>{actions.map(action => cloneElement(action, { disabled }))}</div>
              )}
              {!!secondaryActions.length && (
                <div className={styles.secondaryActions}>
                  {secondaryActions.map(action => cloneElement(action, { disabled }))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardInner>
    </CardContainer>
  );
};

/**
 * @alpha
 */
export const getCardStyles = stylesFactory((theme: GrafanaTheme, disabled = false, disableHover = false) => {
  return {
    container: css`
      display: flex;
      width: 100%;
      color: ${theme.colors.textStrong};
      background: ${theme.colors.bg2};
      border-radius: ${theme.border.radius.sm};
      padding: ${theme.spacing.md};
      position: relative;
      pointer-events: ${disabled ? 'none' : 'auto'};
      margin-bottom: ${theme.spacing.sm};

      &::after {
        content: '';
        display: ${disabled ? 'block' : 'none'};
        position: absolute;
        top: 1px;
        left: 1px;
        right: 1px;
        bottom: 1px;
        background: linear-gradient(180deg, rgba(75, 79, 84, 0.5) 0%, rgba(82, 84, 92, 0.5) 100%);
        width: calc(100% - 2px);
        height: calc(100% - 2px);
        border-radius: ${theme.border.radius.sm};
      }

      &:hover {
        background: ${disableHover ? theme.colors.bg2 : styleMixins.hoverColor(theme.colors.bg2, theme)};
        cursor: ${disableHover ? 'default' : 'pointer'};
      }

      &:focus {
        ${styleMixins.focusCss(theme)};
      }
    `,
    inner: css`
      width: 100%;
    `,
    heading: css`
      margin-bottom: 0;
      font-size: ${theme.typography.size.md};
      line-height: ${theme.typography.lineHeight.xs};
    `,
    metadata: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textSemiWeak};
      margin: ${theme.spacing.sm} 0 0;
      line-height: ${theme.typography.lineHeight.xs};
    `,
    description: css`
      margin: ${theme.spacing.sm} 0 0;
      color: ${theme.colors.textSemiWeak};
      line-height: ${theme.typography.lineHeight.md};
    `,
    media: css`
      margin-right: ${theme.spacing.md};
      max-width: 40px;
      & > * {
        width: 100%;
      }
    `,
    actionRow: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-top: ${theme.spacing.md};
    `,
    actions: css`
      & > * {
        margin-right: ${theme.spacing.sm};
      }
    `,
    secondaryActions: css`
      display: flex;
      align-items: center;
      color: ${theme.colors.textSemiWeak};
      & > * {
        margin-right: ${theme.spacing.sm} !important;
      }
    `,
    separator: css`
      margin: 0 ${theme.spacing.sm};
    `,
    innerLink: css`
      display: flex;
      width: 100%;
    `,
    tagList: css`
      margin-top: ${theme.spacing.sm};
    `,
  };
});
