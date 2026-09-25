import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

/** The full resource fetch state a row/menu is built from - never a legacy rule/group shape. */
export type RuleResourceState<T extends AlertRule | RecordingRule> =
  | { status: 'loading'; rule?: undefined }
  | { status: 'error'; rule?: undefined }
  | { status: 'loaded'; rule: T };

export type MutationOutcome = 'paused' | 'resumed' | 'deleted';

/** Lets the page do its own explicit refresh (search results, counts, trash) after a mutation. */
export type OnMutated = (outcome: MutationOutcome) => void;

export interface ActionAvailability {
  available: boolean;
  /** Why the action is unavailable; omitted when `available` is true. */
  reason?: string;
}

export interface RuleActionAbilities {
  edit: ActionAvailability;
  pause: ActionAvailability;
  delete: ActionAvailability;
  duplicate: ActionAvailability;
}
