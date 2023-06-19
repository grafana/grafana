import { useState, useEffect } from 'react';
import { usePrevious } from 'react-use';

export function useShadowedState<T>(outsideVal: T): [T, (newVal: T) => void] {
  const [currentVal, setCurrentVal] = useState(outsideVal);
  const prevOutsideVal = usePrevious(outsideVal);

  useEffect(() => {
    const isOutsideValChanged = prevOutsideVal !== outsideVal;
    // if the value changes from the outside, we accept it into the state
    // (we only set it if it is different from the current value)
    if (isOutsideValChanged && currentVal !== outsideVal) {
      setCurrentVal(outsideVal);
    }
  }, [outsideVal, currentVal, prevOutsideVal]);

  return [currentVal, setCurrentVal];
}
