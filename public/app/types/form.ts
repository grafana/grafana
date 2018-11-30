export interface ValidationRule {
  rule: (valueToValidate: string) => boolean;
  errorMessage: string;
}

export interface ValidationEvents {
  [eventName: string]: ValidationRule[];
}
