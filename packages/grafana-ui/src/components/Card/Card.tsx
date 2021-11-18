import React, { memo, cloneElement, FC, useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../themes';
import { CardContainer, CardContainerProps } from './CardContainer';
import { getFocusStyles } from '../../themes/mixins';

/**
 * @public
 */
export interface Props extends Omit<CardContainerProps, 'disableEvents' | 'disableHover'> {
  /** Indicates if the card and all its actions can be interacted with */
  disabled?: boolean;
  /** Link to redirect to on card click. If provided, the Card inner content will be rendered inside `a` */
  href?: string;
  /** On click handler for the Card */
  onClick?: () => void;
}

export interface CardInterface extends FC<Props> {
  Heading: FC<ChildProps>;
  Tags: typeof Tags;
  Figure: typeof Figure;
  Meta: typeof Meta;
  Actions: typeof Actions;
  SecondaryActions: typeof SecondaryActions;
  Description: typeof Description;
}
const validComponents = ['Heading', 'Figure', 'Meta', 'Description', 'Tags', 'Actions', 'SecondaryActions'];

/**
 * Generic card component
 *
 * @public
 */
export const Card: CardInterface = ({ disabled, href, onClick, children, ...htmlProps }) => {
  const styles = useStyles2(getCardStyles);
  const onCardClick = onClick && !disabled ? onClick : undefined;
  const subComponents = useMemo(
    () =>
      React.Children.map(children, (c) => {
        const componentType = React.isValidElement(c) && (c.type as any).displayName;
        if (!componentType) {
          return c;
        }

        if (validComponents.includes(componentType)) {
          if (componentType === 'Heading') {
            return React.cloneElement(c, { disabled, styles, href, onClick: onCardClick, ...c.props });
          } else {
            return React.cloneElement(c, { disabled, styles, ...c.props });
          }
        }

        return c;
      }),
    [children, disabled, href, styles, onCardClick]
  );

  const hasHeading = useMemo(
    () =>
      React.Children.toArray(children).some(
        (c) => React.isValidElement(c) && (c.type as any).displayName === Heading.displayName
      ),
    [children]
  );

  const disableHover = disabled || (!onClick && !href);

  return (
    <CardContainer disableEvents={disabled} disableHover={disableHover} {...htmlProps}>
      {!hasHeading && <Heading href={href} onClick={onCardClick}></Heading>}
      {subComponents}
    </CardContainer>
  );
};

interface ChildProps {
  className?: string;
  styles?: ReturnType<typeof getCardStyles>;
  disabled?: boolean;
}

const Heading: FC<ChildProps & { onClick?: () => void; href?: string; 'aria-label'?: string }> = ({
  children,
  href,
  onClick,
  styles,
  className,
  'aria-label': ariaLabel,
}) => {
  return (
    <h2 className={cx(styles?.heading, className)}>
      {href ? (
        <a href={href} className={styles?.linkHack} aria-label={ariaLabel}>
          {children}
        </a>
      ) : onClick ? (
        <button className={styles?.linkHack} onClick={onClick} aria-label={ariaLabel}>
          {children}
        </button>
      ) : (
        <>{children}</>
      )}
    </h2>
  );
};
Heading.displayName = 'Heading';

const Tags: FC<ChildProps> = ({ children, styles, className }) => {
  return <div className={cx(styles?.tagList, className)}>{children}</div>;
};
Tags.displayName = 'Tags';

const Description: FC<ChildProps> = ({ children, styles, className }) => {
  return <p className={cx(styles?.description, className)}>{children}</p>;
};
Description.displayName = 'Description';

const Figure: FC<ChildProps & { align?: 'start' | 'center' }> = ({ children, styles, align = 'start', className }) => {
  return (
    <div
      className={cx(
        styles?.media,
        className,
        css`
          align-self: ${align};
        `
      )}
    >
      {children}
    </div>
  );
};
Figure.displayName = 'Figure';

const Meta: FC<ChildProps & { separator?: string }> = memo(({ children, styles, className, separator = '|' }) => {
  let meta = children;

  // Join meta data elements by separator
  if (Array.isArray(children) && separator) {
    const filtered = React.Children.toArray(children).filter(Boolean);
    if (!filtered.length) {
      return null;
    }
    meta = filtered.reduce((prev, curr, i) => [
      prev,
      <span key={`separator_${i}`} className={styles?.separator}>
        {separator}
      </span>,
      curr,
    ]);
  }
  return <div className={cx(styles?.metadata, className)}>{meta}</div>;
});
Meta.displayName = 'Meta';

interface ActionsProps extends ChildProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

const BaseActions: FC<ActionsProps> = ({ children, styles, disabled, variant, className }) => {
  const css = variant === 'primary' ? styles?.actions : styles?.secondaryActions;
  return (
    <div className={cx(css, className)}>
      {React.Children.map(children, (child) => {
        return React.isValidElement(child) ? cloneElement(child, { disabled, ...child.props }) : null;
      })}
    </div>
  );
};

const Actions: FC<ActionsProps> = ({ children, styles, disabled, className }) => {
  return (
    <BaseActions variant="primary" disabled={disabled} styles={styles} className={className}>
      {children}
    </BaseActions>
  );
};
Actions.displayName = 'Actions';

const SecondaryActions: FC<ActionsProps> = ({ children, styles, disabled, className }) => {
  return (
    <BaseActions variant="secondary" disabled={disabled} styles={styles} className={className}>
      {children}
    </BaseActions>
  );
};
SecondaryActions.displayName = 'SecondaryActions';

/**
 * @public
 */
export const getCardStyles = (theme: GrafanaTheme2) => {
  return {
    inner: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      flex-wrap: wrap;
    `,
    heading: css`
      grid-area: Heading;
      justify-self: start;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-bottom: 0;
      font-size: ${theme.typography.size.md};
      letter-spacing: inherit;
      line-height: ${theme.typography.body.lineHeight};
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    metadata: css`
      grid-area: Meta;
      display: flex;
      align-items: center;
      width: 100%;
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.secondary};
      margin: ${theme.spacing(0.5, 0, 0)};
      line-height: ${theme.typography.bodySmall.lineHeight};
      overflow-wrap: anywhere;
    `,
    description: css`
      width: 100%;
      grid-area: Description;
      margin: ${theme.spacing(1, 0, 0)};
      color: ${theme.colors.text.secondary};
      line-height: ${theme.typography.body.lineHeight};
    `,
    media: css`
      position: relative;
      grid-area: Figure;
      margin-right: ${theme.spacing(2)};
      width: 40px;

      &:empty {
        display: none;
      }
    `,
    linkHack: css`
      all: unset;
      &::after {
        position: absolute;
        content: '';
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        border-radius: ${theme.shape.borderRadius(1)};
      }

      &:focus-visible {
        outline: none;
        outline-offset: 0;
        box-shadow: none;

        &::after {
          ${getFocusStyles(theme)};
          z-index: 1;
        }
      }
    `,
    actions: css`
      grid-area: Actions;
      margin-top: ${theme.spacing(2)};
      & > * {
        margin-right: ${theme.spacing(1)};
      }
    `,
    secondaryActions: css`
      display: flex;
      grid-area: Secondary;
      align-self: center;
      color: ${theme.colors.text.secondary};
      margin-top: ${theme.spacing(2)};

      & > * {
        margin-right: ${theme.spacing(1)} !important;
      }
    `,
    separator: css`
      margin: 0 ${theme.spacing(1)};
    `,
    tagList: css`
      position: relative;
      grid-area: Tags;
      align-self: center;
    `,
  };
};

Card.Heading = Heading;
Card.Tags = Tags;
Card.Figure = Figure;
Card.Meta = Meta;
Card.Actions = Actions;
Card.SecondaryActions = SecondaryActions;
Card.Description = Description;
