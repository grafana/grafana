import { useState, useEffect } from 'react';
import { useThrottle } from 'react-use';

interface MousePosition {
  x: number | null;
  y: number | null;
}

const useMousePosition = (throttleInterval = 50) => {
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
