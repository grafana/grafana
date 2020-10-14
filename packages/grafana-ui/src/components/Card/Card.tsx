import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, styleMixins } from '../../themes';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';
import { OnTagClick } from '../Tags/Tag';
import { TagList } from '../Tags/TagList';

interface ContainerProps extends HTMLAttributes<HTMLOrSVGElement> {
  /** Customise the container html element for the card. Defaults to div */
  tag?: keyof JSX.IntrinsicElements;
}

const CardContainer: FC<ContainerProps> = ({ tag = 'div', children, ...props }) => {
  return React.createElement(tag, props, children);
};

export interface CardInnerProps {
  href?: string;
}

const CardInner: FC<CardInnerProps> = ({ children, href }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  return href ? (
    <a className={styles.innerLink} href={href}>
      {children}
    </a>
  ) : (
    <>{children}</>
  );
};

export interface Props extends ContainerProps {
  /** Main heading for the Card **/
  title: string;
  /** Additional data about the card. If array is supplied, elements will be rendered with vertical line separator */
  metaData?: ReactNode | ReactNode[];
  /** Card description text */
  description?: string;
  /** Content for the card's tooltip */
  tooltip?: PopoverContent;
  /** List of tags to display in the card */
  tags?: string[];
  /** Optional callback for tag onclick event */
  onTagClick?: OnTagClick;
  /** Indicates if the card and all its actions can be interacted with */
  disabled?: boolean;
  /** Image or icon to be displayed on the let side of the card */
  mediaContent?: ReactNode;
  /** Main card actions **/
  actions?: ReactNode[];
  /** Right-side actions */
  secondaryActions?: ReactNode[];
  /** Link to redirect to on card click. If provided, the Card inner content will be rendered inside `a` */
  href?: string;
  /** On click handler for the Card */
  onClick?: () => void;
}

export const Card: FC<Props> = ({
  title,
  description,
  metaData,
  tags = [],
  onTagClick,
  disabled,
  mediaContent,
  actions = [],
  tooltip = '',
  secondaryActions = [],
  tag,
  href,
  onClick,
  className,
  ...htmlProps
}) => {
  const hasActions = Boolean(actions.length || secondaryActions.length);
  const disableHover = actions.length > 1;
  const theme = useTheme();
  const styles = getStyles(theme, disabled && !actions.length, disableHover);
  // Join meta data elements by '|'
  const meta = Array.isArray(metaData)
    ? (metaData as ReactNode[]).reduce((prev, curr, i) => [
        prev,
        <span key={`separator_${i}`} className={styles.separator}>
          |
        </span>,
        curr,
      ])
    : metaData;
  const onCardClick = disabled ? () => {} : onClick;
  return (
    <Tooltip placement="top" content={tooltip} theme="info" show={!!tooltip} {...htmlProps}>
      <CardContainer tag={tag} tabIndex={0} className={cx(styles.container, className)} onClick={onCardClick}>
        <CardInner href={href}>
          {mediaContent && <div className={styles.media}>{mediaContent}</div>}
          <div className={styles.inner}>
            <p className={styles.title}>{title}</p>
            {meta && <p className={styles.metaData}>{meta}</p>}
            {!!tags.length && <TagList tags={tags} onClick={onTagClick} className={styles.tagList} />}
            {description && <p className={styles.description}>{description}</p>}
            {hasActions && (
              <div className={styles.actionRow}>
                {!!actions.length && <div className={styles.actions}>{actions}</div>}
                {!!secondaryActions.length && <div className={styles.secondaryActions}>{secondaryActions}</div>}
              </div>
            )}
          </div>
        </CardInner>
        <div className={styles.overlay} />
      </CardContainer>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme, disabled = false, disableHover = false) => {
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
    title: css`
      margin-bottom: 0;
      font-size: ${theme.typography.size.md};
      line-height: ${theme.typography.lineHeight.xs};
    `,
    metaData: css`
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
    overlay: css`
      position: absolute;
      top: 1px;
      left: 1px;
      right: 1px;
      bottom: 1px;
      background: linear-gradient(180deg, rgba(75, 79, 84, 0.5) 0%, rgba(82, 84, 92, 0.5) 100%);
      width: calc(100% - 2px);
      height: calc(100% - 2px);
      z-index: ${disabled ? 0 : -1};
      border-radius: ${theme.border.radius.sm};
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
};
