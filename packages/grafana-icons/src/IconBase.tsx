import { SVGProps } from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'onLoad' | 'onError' | 'ref'> {
  /** Size (width and height) of the icon. Defaults to "md" or 16x16px */
  size?: IconSize;
  /** Render the title element with the provided text.
   * More info: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/title
   */
  title?: string;
  /** Color of the icon. Defaults to "currentColor" */
  color?: string;
}

function getSvgSize(size: IconSize) {
  const sizeMap = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 36,
    xxxl: 48,
  };

  return sizeMap[size] || 16;
}

export const IconBase = ({ title, size = 'md', color = 'currentColor', ...props }: IconProps) => {
  const svgSize = getSvgSize(size);

  return (
    <svg
      {...props}
      height={svgSize}
      width={svgSize}
      style={{
        display: 'inline-block',
        fill: color,
        flexShrink: 0,
        lineHeight: 0,
        verticalAlign: 'middle',
      }}
    >
      {title && <title>{title}</title>}
      {props.children}
    </svg>
  );
};
