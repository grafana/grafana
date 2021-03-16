import { useState, useEffect, useRef } from 'react';

export function useShadowedState<T>(outsideVal: T): [T, (newVal: T) => void] {
  const [currentVal, setCurrentVal] = useState(outsideVal);
  const prevOutsideVal = useRef(outsideVal);

  useEffect(() => {
    const isOutsideValChanged = prevOutsideVal.current !== outsideVal;
    // the prevOutsideVal must always be updated to the "new" prev-value
    prevOutsideVal.current = outsideVal;
    // if the value changes from the outside, we accept it
    if (isOutsideValChanged && currentVal !== outsideVal) {
      setCurrentVal(outsideVal);
    }
  }, [outsideVal, currentVal]);

  return [currentVal, setCurrentVal];
}
