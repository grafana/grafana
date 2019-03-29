import { StreamingQuery } from '../../types';

export interface FetchQuery extends StreamingQuery {
  url: string;
  fields?: string[];
  speed: number; // Milliseconds
  spread: number; // Spread (for random noise)
}
