import { PromQueryPattern } from '../types';

import { LokiAndPromQueryModellerBase } from './LokiAndPromQueryModellerBase';

export interface QueryModeller extends LokiAndPromQueryModellerBase {
  getQueryPatterns(): PromQueryPattern[];
}

// Create a singleton registry
let modellerInstance: QueryModeller | null = null;

export function setModeller(modeller: QueryModeller) {
  modellerInstance = modeller;
}

export function getModeller(): QueryModeller {
  if (!modellerInstance) {
    throw new Error('QueryModeller not initialized');
  }
  return modellerInstance;
}
