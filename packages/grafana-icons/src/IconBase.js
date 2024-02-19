import React from 'react';

/**
 * @typedef {('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl')} IconSize
 */

/**
 * @typedef {object} IconProps
 * @property {IconSize} [size] - Size (width and height) of the icon. Defaults to "md" or 16x16px
 * @property {string} [title] - Render the title element with the provided text.
 * @property {string} [color] - Color of the icon. Defaults to "currentColor"
 */

/**
 * Base component for rendering an icon.
 * @param title
 * @param size
 * @param color
 * @param {IconProps} props - Props for the IconBase component
 * @returns {JSX.Element} IconBase component
 */
export const IconBase = ({ title, size = 'md', color = 'currentColor', ...props }) => {
  /**
   * Function to get the size of the SVG based on the provided IconSize.
   * @param {IconSize} size - Size of the icon
   * @returns {number} Size of the SVG
   */
  const getSvgSize = (size) => {
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
  };

  const svgSize = getSvgSize(size);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      height={svgSize}
      width={svgSize}
      style={{
        display: 'inline-block',
        fill: color,
        flexShrink: 0,
        lineHeight: 0,
        verticalAlign: 'middle',
      }}
      {...props}
    >
      {title && <title>{title}</title>}
      {props.children}
    </svg>
  );
};
