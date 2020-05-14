export interface DataWarning {
  title: string;
  tip: string;
  action?: () => void;
  actionText?: string;
}
