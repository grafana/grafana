export interface EvaluationChain {
  uid: string;
  name: string;
  /** Folder / namespace the chain belongs to */
  folder: string;
  /** Evaluation interval, e.g. "1m" */
  interval: string;
  /** Names of recording rules that run first in the chain, in order */
  recordingRuleRefs: string[];
  /** Names of alert rules that run after recording rules, in order */
  alertRuleRefs: string[];
}
