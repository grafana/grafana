import { ComponentType } from 'react';
import { DeepPartial, FieldValues, UnpackNestedValue } from 'react-hook-form';

export type WizardProps<T extends FieldValues> = {
  defaultValues: UnpackNestedValue<DeepPartial<T>>;
  pages: ComponentType[];
  navigation: ComponentType;
  onSubmit: (data: FieldValues) => void;
};
