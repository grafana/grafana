import { type ReviewInput } from '../types';

/** Panel plugin ids the corpus harness can load as real `PanelPlugin`s. */
export type CorpusPluginId = 'timeseries' | 'stat' | 'gauge';

/**
 * One example of the human-friendliness specification: a baseline, a payload, and the Review output
 * a person should read, written as `renderReviewText` text.
 */
export interface ReviewCorpusCase {
  name: string;
  input: Omit<ReviewInput, 'getPlugin'> & { plugins?: CorpusPluginId[] };
  expected: string;
}
