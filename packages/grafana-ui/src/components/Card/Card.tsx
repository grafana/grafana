import React, { cloneElement, FC, HTMLAttributes, ReactNode, useCallback, useMemo } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, styleMixins, stylesFactory } from '../../themes';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';

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
  /** Card description text */
  description?: string;
  /** Indicates if the card and all its actions can be interacted with */
  disabled?: boolean;
  /** Link to redirect to on card click. If provided, the Card inner content will be rendered inside `a` */
  href?: string;
  /** On click handler for the Card */
  onClick?: () => void;
}

export interface CardInterface extends FC<Props> {
  Tags: typeof Tags;
  Figure: typeof Figure;
  Meta: typeof Meta;
  Actions: typeof Actions;
  SecondaryActions: typeof SecondaryActions;
}

/**
 * Generic card component
 *
 * @alpha
 */
export const Card: CardInterface = ({
  heading,
  description,
  disabled,
  tooltip,
  href,
  onClick,
  className,
  children,
  ...htmlProps
}) => {
  const theme = useTheme();
  const styles = getCardStyles(theme);
  const [tags, figure, meta, actions, secondaryActions] = ['Tags', 'Figure', 'Meta', 'Actions', 'SecondaryActions'].map(
    item => {
      //@ts-ignore
      const found = React.Children.toArray(children).find((child: JSX.Element) => {
        return child?.type?.displayName === item;
      }) as JSX.Element | undefined;

      if (found) {
        return React.cloneElement(found, { ...found.props, styles, disabled });
      }
      return found;
    }
  );

  const hasActions = Boolean(actions || secondaryActions);
  const disableHover = disabled || !onClick;
  const disableEvents = disabled && !actions;

  const containerStyles = getContainerStyles(theme, disableEvents, disableHover);
  const onCardClick = useCallback(() => (disableHover ? () => {} : onClick), [disableHover, onClick]);

  return (
    <CardContainer
      tooltip={tooltip}
      tabIndex={disableHover ? undefined : 0}
      className={cx(containerStyles, className)}
      onClick={onCardClick}
      {...htmlProps}
    >
      <CardInner href={href}>
        {figure}
        <div className={styles.inner}>
          <div className={styles.heading}>{heading}</div>
          {meta}
          {tags}
          {description && <p className={styles.description}>{description}</p>}
          {hasActions && (
            <div className={styles.actionRow}>
              {actions}
              {secondaryActions}
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
export const getContainerStyles = stylesFactory((theme: GrafanaTheme, disabled = false, disableHover = false) => {
  return css`
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
  `;
});

/**
 * @alpha
 */
export const getCardStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
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

interface ChildProps {
  styles?: ReturnType<typeof getCardStyles>;
  disabled?: boolean;
}

const Tags: FC = ({ children }) => {
  return <>{children}</>;
};
Tags.displayName = 'Tags';

const Figure: FC<ChildProps> = ({ children, styles }) => {
  return <div className={styles?.media}>{children}</div>;
};

Figure.displayName = 'Figure';

const Meta: FC<ChildProps> = ({ children, styles }) => {
  // Join meta data elements by '|'
  const meta = useMemo(
    () =>
      Array.isArray(children)
        ? React.Children.toArray(children).reduce((prev, curr, i) => [
            prev,
            <span key={`separator_${i}`} className={styles?.separator}>
              |
            </span>,
            curr,
          ])
        : children,
    [children, styles?.separator]
  );
  return <div className={styles?.metadata}>{meta}</div>;
};

Meta.displayName = 'Meta';

interface ActionsProps extends ChildProps {
  children: JSX.Element[];
}
const Actions: FC<ActionsProps> = ({ children, styles, disabled }) => {
  return (
    <div className={styles?.actions}>{React.Children.map(children, child => cloneElement(child, { disabled }))}</div>
  );
};

Actions.displayName = 'Actions';

const SecondaryActions: FC<ActionsProps> = ({ children, styles, disabled }) => {
  return (
    <div className={styles?.secondaryActions}>
      {React.Children.map(children, child => cloneElement(child, { disabled }))}
    </div>
  );
};

SecondaryActions.displayName = 'SecondaryActions';

Card.Tags = Tags;
Card.Figure = Figure;
Card.Meta = Meta;
Card.Actions = Actions;
Card.SecondaryActions = SecondaryActions;
