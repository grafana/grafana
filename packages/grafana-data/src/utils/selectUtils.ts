import { SelectableValue } from '../types';

export const toOption = (value: string): SelectableValue<string> => ({ label: value, value });
