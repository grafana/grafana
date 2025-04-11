import { ErrorDetails } from 'app/api/clients/provisioning';

import { WizardFormData } from '../Wizard/types';

export type RepositoryField = keyof WizardFormData['repository'];
export type RepositoryFormPath = `repository.${RepositoryField}`;
export type FormErrorTuple = [RepositoryFormPath | null, { message: string } | null];

/**
 * Maps API error details to form error fields for React Hook Form
 *
 * @param errors Array of error details from the API response
 * @returns Tuple with form field path and error message
 */
export const getFormErrors = (errors: ErrorDetails[]): FormErrorTuple => {
  const fieldMap: Record<string, RepositoryFormPath> = {
    path: 'repository.path',
    branch: 'repository.branch',
    url: 'repository.url',
    token: 'repository.token',
  };
  const fieldsToValidate = Object.values<RepositoryFormPath>(fieldMap);

  for (const error of errors) {
    if (error.field) {
      const cleanField = error.field.replace('spec.', '');
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (fieldsToValidate.includes(cleanField as RepositoryFormPath)) {
        const fieldParts = cleanField.split('.');
        const lastPart = fieldParts[fieldParts.length - 1];

        if (lastPart in fieldMap) {
          return [fieldMap[lastPart], { message: error.detail || `Invalid ${lastPart}` }];
        }
      }
    }
  }

  return [null, null];
};
