import { useState } from 'react';

let uniqueId = 0;
const getUniqueId = () => uniqueId++;

export function useComponentInstanceId(prefix: string): string {
  const [id] = useState(() => prefix + getUniqueId());
  return id;
}
