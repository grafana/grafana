/**
 * The modal's form values, in their own module so the fields component and the modal that owns the
 * form can share the type without importing each other.
 */
export interface AddPanelFormValues {
  /** Which route the panel takes: a notebook that does not exist yet, or one that does. */
  saveTarget: 'new' | 'existing';
  title: string;
  /** Whether the visualization keeps the window it was captured in instead of following the notebook's. */
  lockTimeRange: boolean;
  /** Text added as a markdown cell above what is being added. Blank adds nothing. */
  note: string;
  /** Whether a relative window is locked as the instants it covers now, instead of as "last 6 hours". */
  convertToAbsolute: boolean;
}
