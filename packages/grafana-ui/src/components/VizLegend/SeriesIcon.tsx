import React, { CSSProperties } from 'react';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  color: string;
}

export const SeriesIcon = React.forwardRef<HTMLDivElement, Props>(({ color, className, ...restProps }, ref) => {
  const styles: CSSProperties = {
    backgroundColor: color,
    width: '14px',
    height: '4px',
    borderRadius: '1px',
    display: 'inline-block',
    marginRight: '8px',
  };

  return <div ref={ref} className={className} style={styles} {...restProps} />;
});

SeriesIcon.displayName = 'SeriesIcon';
