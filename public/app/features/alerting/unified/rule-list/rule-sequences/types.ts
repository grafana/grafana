import type { RuleSequenceSpec } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

// Per-rule membership: position/total are derived from the rule's index within the
// ordered sequence members — not fields on the RuleSequence resource.
export interface RuleSequenceMembership {
  id: string; // string: metadata.name is guaranteed non-empty by ?? '' fallback in consumers
}

// Drawer display row: 'recording' | 'alert' derived from which spec array the ref came from;
// name is resolved from AlertRule/RecordingRule spec.title / spec.metric;
// uid is the raw rule UID (metadata.name) used for "You are here" matching.
export interface RuleSequenceStep {
  type: 'recording' | 'alert';
  name: string;
  uid: string;
}

// Assembled drawer view = backend interval + ordered resolved steps.
export interface RuleSequenceView {
  id: string; // string: metadata.name is guaranteed non-empty by ?? '' fallback in consumers
  interval: RuleSequenceSpec['trigger']['interval'];
  steps: RuleSequenceStep[];
}
