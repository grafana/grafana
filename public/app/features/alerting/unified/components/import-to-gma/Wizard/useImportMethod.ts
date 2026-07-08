import { useWatch } from 'react-hook-form';

import { type ImportMethod, type WizardFormValues } from './types';

/**
 * Reactively reads the selected import method from the wizard form. The stepper
 * and nav buttons reflow with the method, so they need the reactive value
 * (`useWatch`) rather than a one-time read. Defaults to `stage` before the form
 * field is registered.
 */
export function useImportMethod(): ImportMethod {
  return useWatch<WizardFormValues>({ name: 'importMethod' }) ?? 'stage';
}
