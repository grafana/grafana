export interface CascaderOption {
  /**
   * The value used under the hood.
   */
  value: string;
  /**
   * The label to display in the UI.
   */
  label: string;
  /** Items are flattened into the list of selectable options recursively. */
  items?: CascaderOption[];
  disabled?: boolean;
  /** Set to false for a branch whose children are loaded asynchronously. */
  isLeaf?: boolean;
  /** Avoid using. */
  title?: string;
  /** Use items instead. Children exists for backwards compatibility. */
  children?: CascaderOption[];
}

export interface CascaderProps {
  /** The separator between levels in the search. */
  separator?: string;
  placeholder?: string;
  /** Leaf nodes must have unique values. */
  options: CascaderOption[];
  /** Changes the value for every selection, including branch nodes. Defaults to true. */
  changeOnSelect?: boolean;
  onSelect(value: string): void;
  /** Sets the width to a multiple of 8px. */
  width?: number;
  /** Must match the value of the last item in the selection chain. */
  initialValue?: string;
  allowCustomValue?: boolean;
  formatCreateLabel?: (value: string) => string;
  displayAllSelectedLevels?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  alwaysOpen?: boolean;
  hideActiveLevelLabel?: boolean;
  disabled?: boolean;
  id?: string;
  isClearable?: boolean;
  'data-testid'?: string;
}
