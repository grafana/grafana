import React from 'react';

export const IconBase = ({ title, size = 'md', color = 'currentColor', ...props }) => {
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
