import { ComponentType } from 'react';
import { DeepPartial, UnpackNestedValue } from 'react-hook-form';

export type WizardProps<T> = {
  /**
   * Initial values for the form
   */
  defaultValues?: UnpackNestedValue<DeepPartial<T>>;

  /**
   * List of steps/pages in the wizard.
   * These are just React components. Wizard component uses react-form-hook. To access the form context
   * inside a page component use useFormContext, e.g.
   * const { register } = useFormContext();
   */
  pages: ComponentType[];

  /**
   * Navigation component to move between previous and next pages.
   *
   * This is a React component. To get access to navigation logic use useWizardContext, e.g.
   * const { currentPage, prevPage, isLastPage } = useWizardContext();
   */
  navigation: ComponentType;

  /**
   * Final callback submitted on the last page
   */
  onSubmit: (data: T) => void;
};
