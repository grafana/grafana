import { useEffect, useState } from 'react';

export function useActiveKeys() {
  const [keyState, setKeyState] = useState<Record<string, boolean | undefined>>({});

  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      setKeyState((old) => ({ ...old, [ev.key]: true }));
    };

    const handleKeyUp = (ev: KeyboardEvent) => {
      setKeyState((old) => ({ ...old, [ev.key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return keyState;
}
