import { ComponentType } from 'react';
import { DeepPartial, UnpackNestedValue } from 'react-hook-form';

export type WizardProps<T> = {
  defaultValues: UnpackNestedValue<DeepPartial<T>>;
  pages: ComponentType[];
  navigation: ComponentType;
  onSubmit: (data: T) => void;
};
