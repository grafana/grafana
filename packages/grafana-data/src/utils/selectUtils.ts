import { SelectableValue } from '../types/select';

export const toOption = (value: string): SelectableValue<string> => ({ label: value, value });
