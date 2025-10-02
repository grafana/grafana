import { ErrorDetails } from 'app/api/clients/provisioning/v0alpha1';

import { WizardFormData } from '../Wizard/types';

export type RepositoryField = keyof WizardFormData['repository'];
export type RepositoryFormPath = `repository.${RepositoryField}` | `repository.sync.intervalSeconds`;
export type FormErrorTuple = [RepositoryFormPath | null, { message: string } | null];

/**
 * Maps API error details to form error fields for React Hook Form
 *
 * @param errors Array of error details from the API response
 * @returns Tuple with form field path and error message
 */
export const getFormErrors = (errors: ErrorDetails[]): FormErrorTuple => {
  const fieldsToValidate = [
    'local.path',
    'github.branch',
    'github.url',
    'github.path',
    'secure.token',
    'gitlab.branch',
    'gitlab.url',
    'bitbucket.branch',
    'bitbucket.url',
    'git.branch',
    'git.url',
    'sync.intervalSeconds',
  ];

  const nestedFieldMap: Record<string, RepositoryFormPath> = {
    'sync.intervalSeconds': 'repository.sync.intervalSeconds',
  };

  const fieldMap: Record<string, RepositoryFormPath> = {
    path: 'repository.path',
    branch: 'repository.branch',
    url: 'repository.url',
    token: 'repository.token',
  };

  for (const error of errors) {
    if (error.field) {
      const cleanField = error.field.replace('spec.', '');
      if (fieldsToValidate.includes(cleanField)) {
        // Check for direct nested field mapping first
        if (cleanField in nestedFieldMap) {
          return [nestedFieldMap[cleanField], { message: error.detail || `Invalid ${cleanField}` }];
        }

        // Fall back to simple field mapping for non-nested fields
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
