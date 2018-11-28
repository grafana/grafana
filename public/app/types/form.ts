export interface ValidationRule {
  rule: (value: string) => boolean;
  errorMessage: string;
}
