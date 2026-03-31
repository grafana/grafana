import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';

export function useLimit(providedLimit: number): [number, Dispatch<SetStateAction<number>>] {
  const [curLimit, setLimit] = useState(providedLimit);
  const lastProvidedLimit = useRef(providedLimit);
  useEffect(() => {
    if (lastProvidedLimit.current !== providedLimit && curLimit !== providedLimit) {
      setLimit(providedLimit);
      lastProvidedLimit.current = providedLimit;
    }
  }, [providedLimit, curLimit]);
  return [curLimit, setLimit];
}
