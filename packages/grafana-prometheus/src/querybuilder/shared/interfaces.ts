import { PromQueryModeller } from '../PromQueryModeller';
import { PromQueryPattern } from '../types';

import { LokiAndPromQueryModellerBase } from './LokiAndPromQueryModellerBase';

export interface QueryModeller extends LokiAndPromQueryModellerBase {
  getQueryPatterns(): PromQueryPattern[];
}

// Create a singleton registry
let modellerInstance: QueryModeller | null = null;

export function getModeller(): QueryModeller {
  if (!modellerInstance) {
    modellerInstance = new PromQueryModeller();
  }
  return modellerInstance;
}
