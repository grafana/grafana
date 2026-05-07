import { createContext, useContext } from 'react';

export interface FieldContextType {
  /**
   * The DOM ID to link the field label to the form control
   */
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Used to link the error message to the form control for screen readers
   *
   * Note: once Voiceover and other screenreaders add support, we should probably use `aria-errormessage`
   */
  'aria-describedby'?: string;
  /**
   * Used to link the label for `RadioButtonGroup` inside an `InlineField`
   *
   * Note: in a normal `Field`, we use a combination of `<fieldset>` and `<legend>`.
   * However when both are used they are "blockified". This won't work for inline fields.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset#styling_with_css
   */
  'aria-labelledby'?: string;
}

export const FieldContext = createContext<FieldContextType>({});
FieldContext.displayName = 'FieldContext';

export const useFieldContext = (): FieldContextType => useContext(FieldContext);
