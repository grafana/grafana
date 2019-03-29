import { StreamingQuery } from '../../types';

export interface RandomStreamQuery extends StreamingQuery {
  speed: number; // Milliseconds
  spread: number; // Spread (for random noise)
}
