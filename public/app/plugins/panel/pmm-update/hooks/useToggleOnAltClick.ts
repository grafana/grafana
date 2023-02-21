import { useState, MouseEvent } from 'react';

export const useToggleOnAltClick = (initialValue = false): [boolean, (e: MouseEvent) => void] => {
  const [toggleValue, setToggleValue] = useState(initialValue);

  const handler = (e: MouseEvent) => {
    if (e.altKey) {
      setToggleValue((currentValue) => !currentValue);
    }
  };

  return [toggleValue, handler];
};
