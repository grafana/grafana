export interface GraphPanelOptions {
  // Panel level options
}

export interface GraphFieldConfig {
  // Custom field properties
}

export interface DataWarning {
  title: string;
  tip: string;
  action?: () => void;
  actionText?: string;
}
