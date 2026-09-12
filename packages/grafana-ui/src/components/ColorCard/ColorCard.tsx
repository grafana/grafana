import { css, cx } from '@emotion/css';
import { type AriaRole, type HTMLAttributes, type ReactNode, createContext, useContext } from 'react';
import * as React from 'react';

import { type ThemeTypographyVariantTypes, type GrafanaTheme2, type ThemeSpacingTokens } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { type IconName, type IconSize } from '../../types/icon';
import { Icon } from '../Icon/Icon';

export type ColorCardVariant = 'success' | 'warning' | 'error' | 'info' | 'tertiary' | 'accent';
export type ColorCardSize = 'sm' | 'md' | 'lg';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: ColorCardVariant;
  size?: ColorCardSize;
  elevated?: boolean;
  /** Convenience shorthand for a single `ColorCard.Title` child */
  title?: string;
  children?: ReactNode;
}

export interface ColorCardInterface
  extends React.ForwardRefExoticComponent<Props & React.RefAttributes<HTMLDivElement>> {
  Icon: typeof ColorCardIcon;
  Title: typeof ColorCardTitle;
  Content: typeof ColorCardContent;
  Actions: typeof ColorCardActions;
}

interface ColorCardContextValue {
  variant: ColorCardVariant;
  size: ColorCardSize;
}

const ColorCardContext = createContext<ColorCardContextValue>({ variant: 'error', size: 'md' });

/** Sub components read variant/size from the card instead of taking them as props */
function useColorCardContext() {
  return useContext(ColorCardContext);
}

const rolesByVariant: Record<ColorCardVariant, AriaRole> = {
  error: 'alert',
  warning: 'alert',
  info: 'status',
  success: 'status',
  tertiary: 'status',
  accent: 'status',
};

const ColorCardComponent = React.forwardRef<HTMLDivElement, Props>(
  ({ title, children, elevated, className, variant = 'error', size = 'md', ...restProps }, ref) => {
    const styles = useStyles2(getStyles, variant, size, elevated);

    const role = restProps['role'] || rolesByVariant[variant];
    const ariaLabel = restProps['aria-label'] || title;

    // Children that are not one of the slot components are treated as card content, so that
    // `<ColorCard title="x">some text</ColorCard>` works without reaching for ColorCard.Content.
    const slots: ReactNode[] = [];
    const loose: ReactNode[] = [];

    for (const child of React.Children.toArray(children)) {
      if (React.isValidElement(child) && SLOT_COMPONENTS.has(child.type)) {
        slots.push(child);
      } else {
        loose.push(child);
      }
    }

    return (
      <ColorCardContext.Provider value={{ variant, size }}>
        <div ref={ref} className={cx(styles.wrapper, className)} role={role} aria-label={ariaLabel} {...restProps}>
          <div data-testid={selectors.components.Alert.alertV2(variant)} className={styles.box}>
            {title && <ColorCardTitle>{title}</ColorCardTitle>}
            {slots}
            {loose.length > 0 && <ColorCardContent>{loose}</ColorCardContent>}
          </div>
        </div>
      </ColorCardContext.Provider>
    );
  }
);

ColorCardComponent.displayName = 'ColorCard';

interface SlotProps {
  className?: string;
  children?: ReactNode;
}

const ColorCardIcon = ({ name, className }: { name: IconName; className?: string }) => {
  const { variant, size } = useColorCardContext();
  const styles = useStyles2(getStyles, variant, size);

  return (
    <div className={cx(styles.icon, className)}>
      <Icon name={name} size={styles.iconSize} />
    </div>
  );
};
ColorCardIcon.displayName = 'ColorCardIcon';

const ColorCardTitle = ({ children, className }: SlotProps) => {
  const { variant, size } = useColorCardContext();
  const styles = useStyles2(getStyles, variant, size);

  return <div className={cx(styles.title, className)}>{children}</div>;
};
ColorCardTitle.displayName = 'ColorCardTitle';

const ColorCardContent = ({ children, className }: SlotProps) => {
  const { variant, size } = useColorCardContext();
  const styles = useStyles2(getStyles, variant, size);

  return <div className={cx(styles.content, className)}>{children}</div>;
};
ColorCardContent.displayName = 'ColorCardContent';

const ColorCardActions = ({ children, className }: SlotProps) => {
  const { variant, size } = useColorCardContext();
  const styles = useStyles2(getStyles, variant, size);

  return <div className={cx(styles.actions, className)}>{children}</div>;
};
ColorCardActions.displayName = 'ColorCardActions';

const SLOT_COMPONENTS: ReadonlySet<unknown> = new Set([
  ColorCardIcon,
  ColorCardTitle,
  ColorCardContent,
  ColorCardActions,
]);

export const ColorCard: ColorCardInterface = Object.assign(ColorCardComponent, {
  Icon: ColorCardIcon,
  Title: ColorCardTitle,
  Content: ColorCardContent,
  Actions: ColorCardActions,
});

function getSpacing(size: ColorCardSize): {
  padding: number;
  iconWidth: number;
  iconSize: IconSize;
  titleVariant: keyof ThemeTypographyVariantTypes;
  titleGap: ThemeSpacingTokens;
} {
  switch (size) {
    case 'sm':
      return { padding: 1, iconWidth: 4, iconSize: 'md', titleVariant: 'h6', titleGap: 0 };
    case 'md':
      return { padding: 2, iconWidth: 5, iconSize: 'xl', titleVariant: 'h5', titleGap: 0.25 };
    case 'lg':
      return { padding: 3, iconWidth: 7, iconSize: 'xxl', titleVariant: 'h4', titleGap: 1 };
  }
}

const getStyles = (theme: GrafanaTheme2, variant: ColorCardVariant, size: ColorCardSize, elevated?: boolean) => {
  const color = theme.colors[variant];
  const sizing = getSpacing(size);

  return {
    wrapper: css({
      flexGrow: 1,
      position: 'relative',

      '&:before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        background: theme.colors.background.primary,
        borderRadius: theme.shape.radius.lg,
        zIndex: -1,
      },
    }),
    box: css({
      display: 'grid',
      gridTemplateAreas: `
        "Icon Title Actions"
        "Icon Content Actions"
      `,
      gridTemplateColumns: 'auto 1fr auto',
      columnGap: theme.spacing(sizing.padding),
      rowGap: theme.spacing(sizing.titleGap),
      alignItems: 'start',
      borderRadius: theme.shape.radius.lg,
      boxShadow: elevated ? theme.shadows.z3 : undefined,
      padding: theme.spacing(sizing.padding),
      background: `color-mix(in oklab, ${theme.components.card.background} 60%, ${color.background})`,
      border: `1px solid color-mix(in oklab, ${theme.colors.background.page} 55%, ${color.border})`,
    }),
    icon: css({
      gridArea: 'Icon',
      color: color.text,
      backgroundColor: `color-mix(in oklab, ${theme.components.card.background} 40%, ${color.backgroundEmphasis})`,
      position: 'relative',
      width: theme.spacing(sizing.iconWidth),
      height: theme.spacing(sizing.iconWidth),
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    iconSize: sizing.iconSize,
    title: css({
      gridArea: 'Title',
      alignSelf: 'center',
      ...theme.typography[sizing.titleVariant],
      color: color.text,
      fontWeight: theme.typography.fontWeightMedium,
      margin: 0,
    }),
    content: css({
      gridArea: 'Content',
      color: theme.colors.text.primary,
      maxHeight: '50vh',
      overflowY: 'auto',
    }),
    actions: css({
      gridArea: 'Actions',
      alignSelf: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
  };
};
