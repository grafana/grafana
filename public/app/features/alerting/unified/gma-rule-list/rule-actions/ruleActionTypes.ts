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
