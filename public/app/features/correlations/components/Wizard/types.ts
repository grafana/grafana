import { ComponentType } from 'react';
import { DeepPartial, UnpackNestedValue } from 'react-hook-form';

export type WizardProps<T> = {
  /**
   * Initial values for the form
   */
  defaultValues?: UnpackNestedValue<DeepPartial<T>>;

  /**
   * List of steps/pages in the wizard.
   * These are just React components. Main wizard uses react-form-hook and useForm() in Wizard component. To get
   * access to form context inside a page use useFormContext, e.g.
   * const { register } = useFormContext();
   */
  pages: ComponentType[];

  /**
   * Navigation component to move between previous and next pages.
   * This is a React component. To get access to navigation logic use useWizardContext, e.g.
   * const { currentPage, prevPage, isLastPage } = useWizardContext();
   * You don't need to handle nextPage explicitly, just mark "Next/Submit" button with type=submit. Wizard will move
   * to the next page or submit the final callback (onSubmit) on the last page. This way each form step will also be
   * validated by react-form-hook.
   */
  navigation: ComponentType;

  /**
   * Final callback submitted on the last page
   */
  onSubmit: (data: T) => void;
};
