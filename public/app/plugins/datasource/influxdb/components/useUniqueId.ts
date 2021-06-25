import { useRef } from 'react';
import { uniqueId } from 'lodash';

export function useUniqueId(): string {
  // we need to lazy-init this ref.
  // otherwise we would call `uniqueId`
  // on every render. unfortunately
  // useRef does not have lazy-init builtin,
  // like useState does. we do it manually.
  const idRefLazy = useRef<string | null>(null);

  if (idRefLazy.current == null) {
    idRefLazy.current = uniqueId();
  }

  return idRefLazy.current;
}
