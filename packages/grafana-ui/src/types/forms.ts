export enum InputStatus {
  Invalid = 'invalid',
  Valid = 'valid',
}

export enum InputTypes {
  Text = 'text',
  Number = 'number',
  Password = 'password',
  Email = 'email',
}

export enum EventsWithValidation {
  onBlur = 'onBlur',
  onFocus = 'onFocus',
  onChange = 'onChange',
}

export interface ValidationRule {
  rule: (valueToValidate: string) => boolean;
  errorMessage: string;
}

export interface ValidationEvents {
  [eventName: string]: ValidationRule[];
}
