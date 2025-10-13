export interface ValidationRule {
  rule: (valueToValidate: string) => boolean;
  errorMessage: string;
}

export interface ValidationEvents {
  // Event name should be one of EventsWithValidation enum
  [eventName: string]: ValidationRule[];
}
