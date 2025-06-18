import { FormEvent } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n/internal';

import { DECRYPT_ALLOW_LIST_LABEL_MAP, LABEL_MAX_LENGTH, SUBDOMAIN_MAX_LENGTH } from './constants';
import {
  FieldErrorMap,
  Secret,
  SecretFormValues,
  SecretPayload,
  SecretsListResponseItem,
  SecretStatusPhase,
} from './types';

export function transformToSecret(subject: SecretsListResponseItem): Secret {
  return {
    name: subject.metadata.name,
    description: subject.spec.description,
    decrypters: subject.spec.decrypters,
    keeper: subject.spec.keeper,
    uid: subject.metadata.uid,
    status: subject.status?.phase ?? SecretStatusPhase.Succeeded,
    created: dateTimeFormat(subject.metadata.creationTimestamp),
    createdBy: subject.metadata.annotations?.['grafana.app/createdBy'],
    modified: dateTimeFormat(subject.metadata.creationTimestamp),
    modifiedBy: subject.metadata.annotations?.['grafana.app/updatedBy'],
    labels: Object.entries(subject.metadata.labels ?? {}).map(([name, value]) => ({
      name,
      value,
    })),
  };
}

/**
 * Converts form values into a payload that can be sent to the backend API.
 *
 * @param {SecretFormValues} formValues
 * @return {SecretPayload}
 */
export function payloadFromFormValues(formValues: SecretFormValues): SecretPayload {
  const isNew = !formValues.uid;
  const decrypters = formValues.decrypters?.map((decrypter) => decrypter.value) ?? [];
  const labels = (formValues?.labels ?? []).reduce<{ labels: Record<string, string> } | undefined>((acc, label) => {
    if (!acc) {
      acc = { labels: {} };
    }

    acc.labels[label.name] = label.value;

    return acc;
  }, undefined);

  const { name, description, value } = formValues;

  // A new secret must have a name and a value
  if (isNew) {
    return {
      metadata: {
        name,
        ...labels,
      },
      spec: {
        description,
        decrypters,
        value: value ?? '',
      },
    };
  }

  // An existing secret cannot update name
  return {
    metadata: {
      name,
      ...labels,
    },
    spec: {
      description,
      decrypters,
      // Omit value property, unless it happens to not be undefined
      ...(!!formValues.value ? { value: formValues.value } : undefined),
    },
  };
}

export function secretToSecretFormValues(secret?: Secret): SecretFormValues | undefined {
  if (typeof secret === 'undefined') {
    return undefined;
  } else {
    return {
      uid: secret.uid,
      name: secret.name,
      description: secret.description,
      decrypters:
        secret.decrypters?.map((decrypter) => {
          if (decrypter in DECRYPT_ALLOW_LIST_LABEL_MAP) {
            return { label: DECRYPT_ALLOW_LIST_LABEL_MAP[decrypter], value: decrypter };
          }

          return { label: `Unsupported (${decrypter})`, value: decrypter };
        }) ?? [],
      labels: secret.labels,
    };
  }
}

export function isSecretPending(secret: Pick<Secret, 'status'>): boolean {
  return secret.status === SecretStatusPhase.Pending;
}

export function validateSecretName(value: string): true | string {
  if (value.length < 1) {
    return t('secrets.form.name.error.required', 'Name is required');
  }

  if (value.length > SUBDOMAIN_MAX_LENGTH) {
    return t('secrets.form.name.error.too-long', 'Name must be less than {{maxLength}} characters', {
      maxLength: SUBDOMAIN_MAX_LENGTH,
    });
  }

  if (!RegExp(/^[a-z\d][a-z\d.-]*$/).test(value)) {
    return t(
      'secrets.form.name.error.invalid',
      'Name must start with a letter or number and can only contain letters, numbers, dashes, and periods'
    );
  }

  return true;
}

export function validateSecretDescription(value: string): true | string {
  if (value.length < 1) {
    return t('secrets.form.description.error.required', 'Description is required');
  }

  if (value.length > SUBDOMAIN_MAX_LENGTH) {
    return t('secrets.form.description.error.too-long', 'Description must be less than {{maxLength}} characters', {
      maxLength: SUBDOMAIN_MAX_LENGTH,
    });
  }

  return true;
}

export function validateSecretValue(value: string | undefined): true | string {
  if (value === undefined) {
    // The assumption is that the value is already set and that the secret is being updated without changing the value
    return true;
  }

  if (value.length < 1) {
    return t('secrets.form.value.error.required', 'Value is required');
  }

  return true;
}

export function validateSecretLabel(key: 'name' | 'value', nameOrValue: string): true | string {
  if (nameOrValue.length < 1) {
    return key === 'name'
      ? t('secrets.form.label-name.error.required', 'Label name is required')
      : t('secrets.form.label-value.error.required', 'Label value is required');
  }

  if (nameOrValue.length > LABEL_MAX_LENGTH) {
    const transValues = {
      maxLength: LABEL_MAX_LENGTH,
    };
    return key === 'name'
      ? t(
          'secrets.form.label-name.error.too-long',
          'Label name must be less than {{maxLength}} characters',
          transValues
        )
      : t(
          'secrets.form.label-value.error.too-long',
          'Label value must be less than {{maxLength}} characters',
          transValues
        );
  }

  if (!RegExp(/^[a-zA-Z\d][a-zA-Z\d._-]*$/).test(nameOrValue)) {
    return key === 'name'
      ? t(
          'secrets.form.label-name.error.invalid',
          'Label name must start with a letter or number and can only contain letters, numbers, dashes, underscores, and periods'
        )
      : t(
          'secrets.form.label-value.error.invalid',
          'Label value must start with a letter or number and can only contain letters, numbers, dashes, underscores, and periods'
        );
  }

  return true;
}

export function checkLabelNameAvailability(
  name: Secret['labels'][number]['name'],
  index: number,
  { labels }: Pick<SecretFormValues, 'labels'>
): true | string {
  const validation = validateSecretLabel('name', name);
  if (validation !== true) {
    return validation;
  }

  // Only check against label names before the current label
  if (labels.slice(0, index).some((subject) => subject.name === name)) {
    return t('secrets.form.label-name.error.unique', 'Label name must be unique');
  }

  return true;
}

/**
 * Persists the cursor position in the input field when the value is transformed.
 * This is useful when the value is transformed (e.g., to lowercase) and the cursor position is lost (moved to end).
 *
 * @param {FormEvent<HTMLInputElement | HTMLTextAreaElement>} event Input/Textarea event
 * @param {(value: string) => string} transformationFunction Function to transform the value
 * @param {(value: string) => void} onTransformedHandler Function to handle the transformed value
 */
export function onChangeTransformation(
  event: FormEvent<HTMLInputElement | HTMLTextAreaElement>,
  transformationFunction: (value: string) => string,
  onTransformedHandler: (value: string) => void
): void {
  const selectionStart = event?.currentTarget?.selectionStart ?? null;
  const value = event.currentTarget.value;
  const transformedValue = transformationFunction(value);

  onTransformedHandler(transformedValue);
  event?.currentTarget?.setSelectionRange?.(selectionStart, selectionStart);
}

/**
 * Transforms the secret name to lowercase and replaces spaces with dashes, to make it a bit more user-friendly.
 * @param {string} value
 */
export function transformSecretName(value: string): string {
  return value.toLowerCase().replaceAll(' ', '-');
}

/**
 * Transforms the secret label (name|value) by replacing spaces with dashes, to make it a bit more user-friendly.
 * @param nameOrValue
 */
export function transformSecretLabel(nameOrValue: string): string {
  return nameOrValue.replaceAll(' ', '-');
}

/**
 * Returns whether a field key exists in errors map created by `react-hook-form (meaning, it's an invalid field)
 * @param {string} fieldName - Name of field to lookup
 * @param {Object} errors - Error map
 */
export function isFieldInvalid(fieldName: string, errors: Record<string, { message?: string } | undefined>) {
  return fieldName in errors ? true : undefined;
}

export function getErrorMessage(error: unknown) {
  const fallback = t('secrets.error-state.unknown-error', 'Unknown error');
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }

    if (
      'data' in error &&
      error.data &&
      typeof error.data === 'object' &&
      'message' in error.data &&
      typeof error.data.message === 'string'
    ) {
      return error.data.message;
    }
  }

  return fallback;
}

export function getFieldErrors(error: unknown): FieldErrorMap | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    error.data &&
    typeof error.data === 'object' &&
    'message' in error.data &&
    typeof error.data.message === 'string'
  ) {
    const { message } = error.data;

    if (/secure value already exists/.test(message)) {
      return { name: { message: t('secrets.form.name.error.unique', 'A secret with this name already exists') } };
    }
  }

  return undefined;
}
