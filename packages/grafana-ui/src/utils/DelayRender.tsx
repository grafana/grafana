import React, { useEffect, useState } from 'react';

interface Props {
  children: React.ReactNode;
  delay: number;
}

/**
 * Delay the rendering of the children by N amount of milliseconds
 */
export function DelayRender({ children, delay }: Props) {
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    window.setTimeout(() => {
      setShouldRender(true);
    }, delay);
  }, [children, delay]);

  return <>{shouldRender ? children : null}</>;
}
