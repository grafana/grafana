import React, { useEffect, useState } from 'react';

interface Props {
  children: React.ReactNode;
  delay: number;
}

/**
 * Delay the rendering of the children by N amount of milliseconds
 */
export function DelayRender({ children, delay }: Props) {
  const [shouldRender, setRender] = useState(false);
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRender(true);
    }, delay);
    return () => {
      clearInterval(intervalId);
    };
  }, [children, delay]);

  return <>{shouldRender ? children : null}</>;
}
