import { useState, useEffect, useRef } from 'react';

export function useShadowedState<T>(outsideVal: T): [T, (newVal: T) => void] {
  const [currentVal, setCurrentVal] = useState(outsideVal);
  const prevOutsideVal = useRef(outsideVal);

  useEffect(() => {
    // if the value changes from the outside, we accept it
    if (prevOutsideVal.current !== outsideVal && currentVal !== outsideVal) {
      prevOutsideVal.current = outsideVal;
      setCurrentVal(outsideVal);
    }
  }, [outsideVal, currentVal]);

  return [currentVal, setCurrentVal];
}
