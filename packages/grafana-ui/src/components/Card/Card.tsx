import { css, cx } from '@emotion/css';
import { memo, cloneElement, FC, useMemo, useContext, ReactNode } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';

import { CardContainer, CardContainerProps, getCardContainerStyles } from './CardContainer';

/**
 * @public
 */
export interface Props extends Omit<CardContainerProps, 'disableEvents' | 'disableHover'> {
  /** Indicates if the card and all its actions can be interacted with */
  disabled?: boolean;
  /** Link to redirect to on card click. If provided, the Card inner content will be rendered inside `a` */
  href?: string;
  /** On click handler for the Card */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** @deprecated Use `Card.Heading` instead */
  heading?: ReactNode;
  /** @deprecated Use `Card.Description` instead */
  description?: string;
  isSelected?: boolean;
  /** If true, the padding of the Card will be smaller */
  isCompact?: boolean;
}

export interface CardInterface extends FC<Props> {
  Heading: typeof Heading;
  Tags: typeof Tags;
  Figure: typeof Figure;
  Meta: typeof Meta;
  Actions: typeof Actions;
  SecondaryActions: typeof SecondaryActions;
  Description: typeof Description;
}

const CardContext = React.createContext<{
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  isSelected?: boolean;
} | null>(null);

/**
 * Generic card component
 *
 * @public
 */
export const Card: CardInterface = ({
  disabled,
  href,
  onClick,
  children,
  isSelected,
  isCompact,
  className,
  ...htmlProps
}) => {
  const hasHeadingComponent = useMemo(
    () => React.Children.toArray(children).some((c) => React.isValidElement(c) && c.type === Heading),
    [children]
  );

  const disableHover = disabled || (!onClick && !href);
  const onCardClick = onClick && !disabled ? onClick : undefined;
  const styles = useStyles2(getCardContainerStyles, disabled, disableHover, isSelected, isCompact);

  return (
    <CardContainer
      disableEvents={disabled}
      disableHover={disableHover}
      isSelected={isSelected}
      className={cx(styles.container, className)}
      {...htmlProps}
    >
      <CardContext.Provider value={{ href, onClick: onCardClick, disabled, isSelected }}>
        {!hasHeadingComponent && <Heading />}
        {children}
      </CardContext.Provider>
    </CardContainer>
  );
};
Card.displayName = 'Card';

interface ChildProps {
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

/** Main heading for the card */
const Heading = ({ children, className, 'aria-label': ariaLabel }: ChildProps & { 'aria-label'?: string }) => {
  const context = useContext(CardContext);
  const styles = useStyles2(getHeadingStyles);

  const { href, onClick, isSelected } = context ?? {
    href: undefined,
    onClick: undefined,
    isSelected: undefined,
  };

  return (
    <h2 className={cx(styles.heading, className)}>
      {href ? (
        <a href={href} className={styles.linkHack} aria-label={ariaLabel} onClick={onClick}>
          {children}
        </a>
      ) : onClick ? (
        <button onClick={onClick} className={styles.linkHack} aria-label={ariaLabel} type="button">
          {children}
        </button>
      ) : (
        <>{children}</>
      )}
      {/* Input must be readonly because we are providing a value for the checked prop with no onChange handler */}
      {isSelected !== undefined && <input aria-label="option" type="radio" checked={isSelected} readOnly />}
    </h2>
  );
};
Heading.displayName = 'Heading';

const getHeadingStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    gridArea: 'Heading',
    justifySelf: 'start',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 0,
    fontSize: theme.typography.size.md,
    letterSpacing: 'inherit',
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
    '& input[readonly]': {
      cursor: 'inherit',
    },
  }),
  linkHack: css({
    all: 'unset',
    '&::after': {
      position: 'absolute',
      content: '""',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: theme.shape.radius.default,
    },

    '&:focus-visible': {
      outline: 'none',
      outlineOffset: 0,
      boxShadow: 'none',

      '&::after': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },
    },
  }),
});

const Tags = ({ children, className }: ChildProps) => {
  const styles = useStyles2(getTagStyles);
  return <div className={cx(styles.tagList, className)}>{children}</div>;
};
Tags.displayName = 'Tags';

const getTagStyles = (theme: GrafanaTheme2) => ({
  tagList: css({
    position: 'relative',
    gridArea: 'Tags',
    alignSelf: 'center',
  }),
});

/** Card description text */
const Description = ({ children, className }: ChildProps) => {
  const styles = useStyles2(getDescriptionStyles);
  return <p className={cx(styles.description, className)}>{children}</p>;
};
Description.displayName = 'Description';

const getDescriptionStyles = (theme: GrafanaTheme2) => ({
  description: css({
    width: '100%',
    gridArea: 'Description',
    margin: theme.spacing(1, 0, 0),
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.body.lineHeight,
  }),
});

const Figure = ({ children, align = 'start', className }: ChildProps & { align?: 'start' | 'center' }) => {
  const styles = useStyles2(getFigureStyles);
  return (
    <div
      className={cx(
        styles.media,
        className,
        css({
          alignSelf: align,
        })
      )}
    >
      {children}
    </div>
  );
};
Figure.displayName = 'Figure';

const getFigureStyles = (theme: GrafanaTheme2) => ({
  media: css({
    position: 'relative',
    gridArea: 'Figure',

    marginRight: theme.spacing(2),
    width: '40px',

    '> img': {
      width: '100%',
    },

    '&:empty': {
      display: 'none',
    },
  }),
});

const Meta = memo(({ children, className, separator = '|' }: ChildProps & { separator?: string }) => {
  const styles = useStyles2(getMetaStyles);
  let meta = children;

  const filtered = React.Children.toArray(children).filter(Boolean);
  if (!filtered.length) {
    return null;
  }
  meta = filtered.map((element, i) => (
    <div key={`element_${i}`} className={styles.metadataItem}>
      {element}
    </div>
  ));
  // Join meta data elements by separator
  if (filtered.length > 1 && separator) {
    meta = filtered.reduce((prev, curr, i) => [
      prev,
      <span key={`separator_${i}`} className={styles.separator}>
        {separator}
      </span>,
      curr,
    ]);
  }
  return <div className={cx(styles.metadata, className)}>{meta}</div>;
});
Meta.displayName = 'Meta';

const getMetaStyles = (theme: GrafanaTheme2) => ({
  metadata: css({
    gridArea: 'Meta',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    margin: theme.spacing(0.5, 0, 0),
    lineHeight: theme.typography.bodySmall.lineHeight,
    overflowWrap: 'anywhere',
  }),
  metadataItem: css({
    // Needed to allow for clickable children in metadata
    zIndex: 0,
  }),
  separator: css({
    margin: `0 ${theme.spacing(1)}`,
  }),
});

interface ActionsProps extends ChildProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

const BaseActions = ({ children, disabled, variant, className }: ActionsProps) => {
  const styles = useStyles2(getActionStyles);
  const context = useContext(CardContext);
  const isDisabled = context?.disabled || disabled;

  const css = variant === 'primary' ? styles.actions : styles.secondaryActions;
  return (
    <div className={cx(css, className)}>
      {React.Children.map(children, (child) => {
        return React.isValidElement(child) ? cloneElement(child, { disabled: isDisabled, ...child.props }) : null;
      })}
    </div>
  );
};

const getActionStyles = (theme: GrafanaTheme2) => ({
  actions: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    gridArea: 'Actions',
    marginTop: theme.spacing(2),
  }),
  secondaryActions: css({
    alignSelf: 'center',
    color: theme.colors.text.secondary,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    gridArea: 'Secondary',
    marginTop: theme.spacing(2),
  }),
});

const Actions = ({ children, disabled, className }: ChildProps) => {
  return (
    <BaseActions variant="primary" disabled={disabled} className={className}>
      {children}
    </BaseActions>
  );
};
Actions.displayName = 'Actions';

const SecondaryActions = ({ children, disabled, className }: ChildProps) => {
  return (
    <BaseActions variant="secondary" disabled={disabled} className={className}>
      {children}
    </BaseActions>
  );
};
SecondaryActions.displayName = 'SecondaryActions';

/**
 * @public
 * @deprecated Use `className` on respective components to modify styles
 */
export const getCardStyles = (theme: GrafanaTheme2) => {
  return {
    inner: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      flexWrap: 'wrap',
    }),
    ...getHeadingStyles(theme),
    ...getMetaStyles(theme),
    ...getDescriptionStyles(theme),
    ...getFigureStyles(theme),
    ...getActionStyles(theme),
    ...getTagStyles(theme),
  };
};

Card.Heading = Heading;
Card.Tags = Tags;
Card.Figure = Figure;
Card.Meta = Meta;
Card.Actions = Actions;
Card.SecondaryActions = SecondaryActions;
Card.Description = Description;
