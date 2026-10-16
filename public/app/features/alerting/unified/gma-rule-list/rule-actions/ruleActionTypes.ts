export interface ActionAvailability {
  available: boolean;
  /** Why the action is unavailable; omitted when `available` is true. */
  reason?: string;
  /** Still resolving; menu items stay rendered but disabled so the menu keeps its shape. */
  checking?: boolean;
}

export interface RuleActionAbilities {
  edit: ActionAvailability;
  pause: ActionAvailability;
  delete: ActionAvailability;
  duplicate: ActionAvailability;
}
