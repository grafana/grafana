import { PromQueryModeller } from '../PromQueryModeller';

// Create a singleton registry to avoid circular deps
let queryModeller: PromQueryModeller | null = null;

export function setQueryModeller(modeller: PromQueryModeller) {
  queryModeller = modeller;
}

export function getQueryModeller(): PromQueryModeller {
  if (!queryModeller) {
    throw new Error('QueryModeller not initialized');
  }
  return queryModeller;
}
