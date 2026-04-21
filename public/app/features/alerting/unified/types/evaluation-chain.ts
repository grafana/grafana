export interface EvaluationChain {
  uid: string;
  name: string;
  intervalSeconds: number;
  interval: string; // Formatted PromDuration e.g. "1m"
  recordingRuleRefs: string[]; // Rule UIDs
  alertRuleRefs: string[]; // Rule UIDs
  folderUid?: string;
}

export interface RecordingRuleReference {
  uid: string;
  name: string;
  metric: string;
  chainUid?: string; // undefined if not in any chain
  chainName?: string;
}

export enum EvaluationScenario {
  NoRecordingRules = 'no-recording-rules',
  SingleChain = 'single-chain',
  UnchainedRecordingRules = 'unchained-recording-rules',
  MultipleChains = 'multiple-chains',
}
