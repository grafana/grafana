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
