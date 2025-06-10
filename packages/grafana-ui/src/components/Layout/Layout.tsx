import { css, cx } from '@emotion/css';
import { HTMLProps } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

enum Orientation {
  Horizontal,
  Vertical,
}
type Spacing = 'none' | 'xs' | 'sm' | 'md' | 'lg';
type Justify = 'flex-start' | 'flex-end' | 'space-between' | 'center';
type Align = 'normal' | 'flex-start' | 'flex-end' | 'center';

export interface LayoutProps extends Omit<HTMLProps<HTMLDivElement>, 'align' | 'children' | 'wrap'> {
  children: React.ReactNode[] | React.ReactNode;
  orientation?: Orientation;
  spacing?: Spacing;
  justify?: Justify;
  align?: Align;
  width?: string;
  wrap?: boolean;
}

export interface ContainerProps {
  padding?: Spacing;
  margin?: Spacing;
  grow?: number;
  shrink?: number;
}

/**
 * @deprecated use Stack component instead
 */
export const Layout = ({
  children,
  orientation = Orientation.Horizontal,
  spacing = 'sm',
  justify = 'flex-start',
  align = 'normal',
  wrap = false,
  width = '100%',
  height = '100%',
  ...rest
}: LayoutProps) => {
  const styles = useStyles2(getStyles, orientation, spacing, justify, align, wrap);

  return (
    <div className={styles.layout} style={{ width, height }} {...rest}>
      {React.Children.toArray(children)
        .filter(Boolean)
        .map((child, index) => {
          return (
            <div className={styles.childWrapper} key={index}>
              {child}
            </div>
          );
        })}
    </div>
  );
};

/**
 * @deprecated use Stack component instead
 */
export const HorizontalGroup = ({
  children,
  spacing,
  justify,
  align = 'center',
  wrap,
  width,
  height,
}: Omit<LayoutProps, 'orientation'>) => (
  <Layout
    spacing={spacing}
    justify={justify}
    orientation={Orientation.Horizontal}
    align={align}
    width={width}
    height={height}
    wrap={wrap}
  >
    {children}
  </Layout>
);

/**
 * @deprecated use Stack component with the "column" direction instead
 */
export const VerticalGroup = ({
  children,
  spacing,
  justify,
  align,
  width,
  height,
}: Omit<LayoutProps, 'orientation' | 'wrap'>) => (
  <Layout
    spacing={spacing}
    justify={justify}
    orientation={Orientation.Vertical}
    align={align}
    width={width}
    height={height}
  >
    {children}
  </Layout>
);

export const Container = ({ children, padding, margin, grow, shrink }: React.PropsWithChildren<ContainerProps>) => {
  const styles = useStyles2(getContainerStyles, padding, margin);

  return (
    <div
      className={cx(
        styles.wrapper,
        grow !== undefined && css({ flexGrow: grow }),
        shrink !== undefined && css({ flexShrink: shrink })
      )}
    >
      {children}
    </div>
  );
};

const getStyles = (
  theme: GrafanaTheme2,
  orientation: Orientation,
  spacing: Spacing,
  justify: Justify,
  align: Align,
  wrap: boolean
) => {
  const finalSpacing = spacing !== 'none' ? theme.spacing(spacingToNumber[spacing]) : 0;

  // compensate for last row margin when wrapped, horizontal layout
  const marginCompensation =
    (orientation === Orientation.Horizontal && !wrap) || orientation === Orientation.Vertical ? 0 : `-${finalSpacing}`;

  const label = orientation === Orientation.Vertical ? 'vertical-group' : 'horizontal-group';

  return {
    layout: css({
      label: label,
      display: 'flex',
      flexDirection: orientation === Orientation.Vertical ? 'column' : 'row',
      flexWrap: wrap ? 'wrap' : 'nowrap',
      justifyContent: justify,
      alignItems: align,
      height: '100%',
      maxWidth: '100%',
      // compensate for last row margin when wrapped, horizontal layout
      marginBottom: marginCompensation,
    }),
    childWrapper: css({
      label: 'layoutChildrenWrapper',
      marginBottom: orientation === Orientation.Horizontal && !wrap ? 0 : finalSpacing,
      marginRight: orientation === Orientation.Horizontal ? finalSpacing : 0,
      display: 'flex',
      alignItems: align,

      '&:last-child': {
        marginBottom: orientation === Orientation.Vertical ? 0 : undefined,
        marginRight: orientation === Orientation.Horizontal ? 0 : undefined,
      },
    }),
  };
};

const spacingToNumber: Record<Spacing, number> = {
  none: 0,
  xs: 0.5,
  sm: 1,
  md: 2,
  lg: 3,
};

const getContainerStyles = (theme: GrafanaTheme2, padding?: Spacing, margin?: Spacing) => {
  const paddingSize = (padding && padding !== 'none' && theme.spacing(spacingToNumber[padding])) || 0;
  const marginSize = (margin && margin !== 'none' && theme.spacing(spacingToNumber[margin])) || 0;
  return {
    wrapper: css({
      label: 'container',
      margin: marginSize,
      padding: paddingSize,
    }),
  };
};
