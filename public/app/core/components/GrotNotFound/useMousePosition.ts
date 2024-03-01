import { useState, useEffect } from 'react';
import { useThrottle } from 'react-use';

interface MousePosition {
  x: number | null;
  y: number | null;
}

// For performance reasons, we throttle the mouse position updates
const DEFAULT_THROTTLE_INTERVAL_MS = 50;

const useMousePosition = (throttleInterval = DEFAULT_THROTTLE_INTERVAL_MS) => {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: null, y: null });
  const throttledValue = useThrottle(mousePosition, throttleInterval);

  useEffect(() => {
    const updateMousePosition = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener('mousemove', updateMousePosition);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, []);

  return throttleInterval ? throttledValue : mousePosition;
};

export default useMousePosition;
