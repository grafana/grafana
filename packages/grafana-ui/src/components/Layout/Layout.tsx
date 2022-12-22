import { css, cx } from '@emotion/css';
import React, { HTMLProps, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

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
  const styles = useStyles2(
    useCallback(
      (theme) => getStyles(theme, orientation, spacing, justify, align, wrap),
      [align, justify, orientation, spacing, wrap]
    )
  );

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
  const styles = useStyles2(useCallback((theme) => getContainerStyles(theme, padding, margin), [padding, margin]));

  return (
    <div
      className={cx(
        styles.wrapper,
        grow !== undefined &&
          css`
            flex-grow: ${grow};
          `,
        shrink !== undefined &&
          css`
            flex-shrink: ${shrink};
          `
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
    layout: css`
      label: ${label};
      display: flex;
      flex-direction: ${orientation === Orientation.Vertical ? 'column' : 'row'};
      flex-wrap: ${wrap ? 'wrap' : 'nowrap'};
      justify-content: ${justify};
      align-items: ${align};
      height: 100%;
      max-width: 100%;
      // compensate for last row margin when wrapped, horizontal layout
      margin-bottom: ${marginCompensation};
    `,
    childWrapper: css`
      label: layoutChildrenWrapper;
      margin-bottom: ${orientation === Orientation.Horizontal && !wrap ? 0 : finalSpacing};
      margin-right: ${orientation === Orientation.Horizontal ? finalSpacing : 0};
      display: flex;
      align-items: ${align};

      &:last-child {
        margin-bottom: ${orientation === Orientation.Vertical && 0};
        margin-right: ${orientation === Orientation.Horizontal && 0};
      }
    `,
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
    wrapper: css`
      label: container;
      margin: ${marginSize};
      padding: ${paddingSize};
    `,
  };
};
