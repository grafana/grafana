import React, { memo, cloneElement, FC, ReactNode, useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2, stylesFactory } from '../../themes';
import { CardContainer, CardContainerProps } from './CardContainer';

/**
 * @public
 */
export interface Props extends Omit<CardContainerProps, 'disableEvents' | 'disableHover'> {
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
 * @public
 */
export const Card: CardInterface = ({
  heading,
  description,
  disabled,
  href,
  onClick,
  className,
  children,
  ...htmlProps
}) => {
  const theme = useTheme2();
  const styles = getCardStyles(theme);
  const [tags, figure, meta, actions, secondaryActions] = ['Tags', 'Figure', 'Meta', 'Actions', 'SecondaryActions'].map(
    (item) => {
      const found = React.Children.toArray(children as React.ReactElement[]).find((child) => {
        return child?.type && (child.type as any).displayName === item;
      });

      if (found) {
        return React.cloneElement(found, { disabled, styles, ...found.props });
      }
      return found;
    }
  );

  const hasActions = Boolean(actions || secondaryActions);
  const disableHover = disabled || (!onClick && !href);
  const disableEvents = disabled && !actions;

  const onCardClick = useCallback(() => (disableHover ? () => {} : onClick?.()), [disableHover, onClick]);

  return (
    <CardContainer
      tabIndex={disableHover ? undefined : 0}
      onClick={onCardClick}
      disableEvents={disableEvents}
      disableHover={disableHover}
      href={href}
      {...htmlProps}
    >
      {figure}
      <div className={styles.inner}>
        <div className={styles.info}>
          <div>
            <div className={styles.heading} role="heading">
              {heading}
            </div>
            {meta}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {tags}
        </div>
        {hasActions && (
          <div className={styles.actionRow}>
            {actions}
            {secondaryActions}
          </div>
        )}
      </div>
    </CardContainer>
  );
};

/**
 * @public
 */
export const getCardStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    inner: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      flex-wrap: wrap;
    `,
    heading: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-bottom: 0;
      font-size: ${theme.typography.size.md};
      line-height: ${theme.typography.body.lineHeight};
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    info: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    `,
    metadata: css`
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
      margin: ${theme.spacing(1, 0, 0)};
      color: ${theme.colors.text.secondary};
      line-height: ${theme.typography.body.lineHeight};
    `,
    media: css`
      margin-right: ${theme.spacing(2)};
      width: 40px;

      & > * {
        width: 100%;
      }

      &:empty {
        display: none;
      }
    `,
    actionRow: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-top: ${theme.spacing(2)};
    `,
    actions: css`
      & > * {
        margin-right: ${theme.spacing(1)};
      }
    `,
    secondaryActions: css`
      display: flex;
      align-items: center;
      color: ${theme.colors.text.secondary};
      // align to the right
      margin-left: auto;
      & > * {
        margin-right: ${theme.spacing(1)} !important;
      }
    `,
    separator: css`
      margin: 0 ${theme.spacing(1)};
    `,
    tagList: css`
      max-width: 50%;
    `,
  };
});

interface ChildProps {
  styles?: ReturnType<typeof getCardStyles>;
  disabled?: boolean;
}

const Tags: FC<ChildProps> = ({ children, styles }) => {
  return <div className={styles?.tagList}>{children}</div>;
};
Tags.displayName = 'Tags';

const Figure: FC<ChildProps & { align?: 'top' | 'center'; className?: string }> = ({
  children,
  styles,
  align = 'top',
  className,
}) => {
  return (
    <div
      className={cx(
        styles?.media,
        className,
        align === 'center' &&
          css`
            display: flex;
            align-items: center;
          `
      )}
    >
      {children}
    </div>
  );
};

Figure.displayName = 'Figure';

const Meta: FC<ChildProps & { separator?: string }> = memo(({ children, styles, separator = '|' }) => {
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
  return <div className={styles?.metadata}>{meta}</div>;
});

Meta.displayName = 'Meta';

interface ActionsProps extends ChildProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

const BaseActions: FC<ActionsProps> = ({ children, styles, disabled, variant }) => {
  const css = variant === 'primary' ? styles?.actions : styles?.secondaryActions;
  return (
    <div className={css}>
      {React.Children.map(children, (child) => {
        return React.isValidElement(child) ? cloneElement(child, { disabled, ...child.props }) : null;
      })}
    </div>
  );
};

const Actions: FC<ActionsProps> = ({ children, styles, disabled }) => {
  return (
    <BaseActions variant="primary" disabled={disabled} styles={styles}>
      {children}
    </BaseActions>
  );
};

Actions.displayName = 'Actions';

const SecondaryActions: FC<ActionsProps> = ({ children, styles, disabled }) => {
  return (
    <BaseActions variant="secondary" disabled={disabled} styles={styles}>
      {children}
    </BaseActions>
  );
};

SecondaryActions.displayName = 'SecondaryActions';

Card.Tags = Tags;
Card.Figure = Figure;
Card.Meta = Meta;
Card.Actions = Actions;
Card.SecondaryActions = SecondaryActions;
