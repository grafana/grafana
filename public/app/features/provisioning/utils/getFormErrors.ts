import { Path } from 'react-hook-form';

import { ErrorDetails, StatusCause, Status } from 'app/api/clients/provisioning/v0alpha1';
import { extractStatusCauses } from 'app/api/utils';

import { WizardFormData } from '../Wizard/types';
import { ConnectionFormData, RepositoryFormData } from '../types';

export type RepositoryField = keyof WizardFormData['repository'];
export type RepositoryFormPath = `repository.${RepositoryField}` | 'repository.sync.intervalSeconds';

type GenericFormPath = string;
type GenericFormErrors<T extends GenericFormPath> = Array<[T, { message: string }]>;

/**
 * Convert StatusCause to ErrorDetails format
 */
function statusCauseToErrorDetails(cause: StatusCause): ErrorDetails {
  return {
    field: cause.field,
    detail: cause.message,
    type: cause.reason ?? 'Unknown',
  };
}

/**
 * Type guard to check if data has an errors array
 */
function hasErrorsArray(data: object): data is { errors: ErrorDetails[] } {
  return 'errors' in data && Array.isArray(data.errors);
}

/**
 * Extract errors from either the Kubernetes Status format or the standard errors array.
 * Returns errors in ErrorDetails[] format.
 */
export function extractFormErrors(data: ErrorDetails[] | Status): ErrorDetails[] {
  const causes = extractStatusCauses<StatusCause>(data);
  if (causes.length > 0) {
    return causes.map(statusCauseToErrorDetails);
  }

  // Fall back to standard errors array format
  if (hasErrorsArray(data)) {
    return data.errors;
  }

  return [];
}

/**
 * Normalize API field name by removing "spec." prefix.
 */
const normalizeField = (field: string): string => field.replace(/^spec\./, '');

/**
 * Given a list of error details and a field mapping,
 * returns all matched form errors.
 */
function mapErrorsToField<T extends GenericFormPath>(
  errors: ErrorDetails[] | undefined,
  fieldMap: Record<string, T>,
  opts?: { allowPartial?: boolean }
): GenericFormErrors<T> {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors
    .map((error) => {
      if (!error.field) {
        return null;
      }

      const normalized = normalizeField(error.field);
      const segments = normalized.split('.');
      const lastPart = segments[segments.length - 1];

      // Direct full match (e.g. "sync.intervalSeconds")
      if (normalized in fieldMap) {
        return [fieldMap[normalized], { message: error.detail || `Invalid ${normalized}` }] as const;
      }

      // Partial match by last key (e.g. "url" -> "repository.url")
      if (opts?.allowPartial && lastPart in fieldMap) {
        return [fieldMap[lastPart], { message: error.detail || `Invalid ${lastPart}` }] as const;
      }

      return null;
    })
    .filter((item): item is [T, { message: string }] => item !== null);
}

// Wizard form errors
export type FormErrors = GenericFormErrors<RepositoryFormPath>;
export const getFormErrors = (data: ErrorDetails[] | Status): FormErrors => {
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

  const errors = extractFormErrors(data);
  return mapErrorsToField(errors, fieldMap, { allowPartial: true });
};

// Config form errors
export type ConfigFormPath = Path<RepositoryFormData>;
export type ConfigFormErrors = GenericFormErrors<ConfigFormPath>;

export const getConfigFormErrors = (data: ErrorDetails[] | Status): ConfigFormErrors => {
  const fieldMap: Record<string, ConfigFormPath> = {
    path: 'path',
    branch: 'branch',
    url: 'url',
    token: 'token',
    tokenUser: 'tokenUser',
    'sync.intervalSeconds': 'sync.intervalSeconds',
  };

  const errors = extractFormErrors(data);
  return mapErrorsToField(errors, fieldMap, { allowPartial: true });
};

// Connection form errors
export type ConnectionFormPath = Path<ConnectionFormData>;
export type ConnectionFormErrors = GenericFormErrors<ConnectionFormPath>;

export const getConnectionFormErrors = (data: ErrorDetails[] | Status): ConnectionFormErrors => {
  const fieldMap: Record<string, ConnectionFormPath> = {
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    title: 'title',
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    description: 'description',
    appID: 'appID',
    installationID: 'installationID',
    'github.appID': 'appID',
    'github.installationID': 'installationID',
    'secure.privateKey': 'privateKey',
    privateKey: 'privateKey',
  };

  const errors = extractFormErrors(data);
  return mapErrorsToField(errors, fieldMap, { allowPartial: true });
};
