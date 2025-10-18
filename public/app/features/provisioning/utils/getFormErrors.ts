import { Path } from 'react-hook-form';

import { ErrorDetails } from 'app/api/clients/provisioning/v0alpha1';

import { WizardFormData } from '../Wizard/types';
import { RepositoryFormData } from '../types';

export type RepositoryField = keyof WizardFormData['repository'];
export type RepositoryFormPath = `repository.${RepositoryField}` | 'repository.sync.intervalSeconds';

type GenericFormPath = string;
type GenericFormErrorTuple<T extends GenericFormPath> = [T | null, { message: string } | null];

/**
 * Normalize API field name by removing "spec." prefix.
 */
const normalizeField = (field: string): string => field.replace(/^spec\./, '');

/**
 * Given a list of error details and a field mapping,
 * returns the first matched form error tuple.
 */
function mapErrorsToField<T extends GenericFormPath>(
  errors: ErrorDetails[] | undefined,
  fieldMap: Record<string, T>,
  opts?: { allowPartial?: boolean }
): GenericFormErrorTuple<T> {
  if (!errors || errors.length === 0) {
    return [null, null];
  }

  for (const error of errors) {
    if (!error.field) {
      continue;
    }

    const normalized = normalizeField(error.field);
    const segments = normalized.split('.');
    const lastPart = segments[segments.length - 1];

    // Direct full match (e.g. "sync.intervalSeconds")
    if (normalized in fieldMap) {
      return [fieldMap[normalized], { message: error.detail || `Invalid ${normalized}` }];
    }

    // Partial match by last key (e.g. "url" -> "repository.url")
    if (opts?.allowPartial && lastPart in fieldMap) {
      return [fieldMap[lastPart], { message: error.detail || `Invalid ${lastPart}` }];
    }
  }

  return [null, null];
}

// Wizard form errors
export type FormErrorTuple = GenericFormErrorTuple<RepositoryFormPath>;
export const getFormErrors = (errors: ErrorDetails[]): FormErrorTuple => {
  const fieldMap: Record<string, RepositoryFormPath> = {
    'local.path': 'repository.path',
    'github.branch': 'repository.branch',
    'github.url': 'repository.url',
    'github.path': 'repository.path',
    'secure.token': 'repository.token',
    'gitlab.branch': 'repository.branch',
    'gitlab.url': 'repository.url',
    'bitbucket.branch': 'repository.branch',
    'bitbucket.url': 'repository.url',
    'git.branch': 'repository.branch',
    'git.url': 'repository.url',
    'sync.intervalSeconds': 'repository.sync.intervalSeconds',
  };

  return mapErrorsToField(errors, fieldMap, { allowPartial: true });
};

// Config form errors
export type ConfigFormPath = Path<RepositoryFormData>;
export type ConfigFormErrorTuple = GenericFormErrorTuple<ConfigFormPath>;

export const getConfigFormErrors = (errors?: ErrorDetails[]): ConfigFormErrorTuple => {
  const fieldMap: Record<string, ConfigFormPath> = {
    path: 'path',
    branch: 'branch',
    url: 'url',
    token: 'token',
    tokenUser: 'tokenUser',
    'sync.intervalSeconds': 'sync.intervalSeconds',
  };

  return mapErrorsToField(errors, fieldMap, { allowPartial: true });
};
