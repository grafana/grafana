import { useRef } from 'react';

let uniqueId = 0;
const getUniqueId = () => uniqueId++;

export function useComponentInstanceId(prefix: string): string {
  const idRef = useRef<string | null>(null);

  if (idRef.current === null) {
    idRef.current = prefix + getUniqueId();
  }

  return idRef.current!.toString();
}
