import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { SecretFormValues } from './components/SecretForm';
import { AllowedDecrypter, DECRYPT_ALLOW_LIST_LABEL_MAP, SUBDOMAIN_MAX_LENGTH } from './constants';
import {
  CreateSecretPayload,
  NewSecret,
  Secret,
  SecretsListResponse,
  SecretsListResponseItem,
  SecretStatusPhase,
} from './types';

export function transformListResponse(response: SecretsListResponse): Secret[] {
  if (!response.items) {
    return [];
  }

  return response.items.map(transformToSecret);
}

export function transformToSecret(subject: SecretsListResponseItem): Secret {
  return {
    name: subject.metadata.name,
    description: subject.spec.description,
    audiences: subject.spec.decrypters,
    keeper: subject.spec.keeper,
    uid: subject.metadata.uid,
    status: subject.status?.phase ?? SecretStatusPhase.Succeeded,
    created: dateTimeFormatTimeAgo(subject.metadata.creationTimestamp),
    createdBy: subject.metadata.annotations?.['grafana.app/createdBy'],
    modified: dateTimeFormat(subject.metadata.creationTimestamp),
    modifiedBy: subject.metadata.annotations?.['grafana.app/updatedBy'],
  };
}

export function transformFromSecret(
  secret: (Partial<Secret> & { value?: string }) | SecretFormValues
): CreateSecretPayload | Omit<CreateSecretPayload, CreateSecretPayload['spec']['value']> {
  return {
    metadata: {
      name: secret.name,
      ...(!!secret.uid ? { uid: secret.uid } : undefined),
      labels: {
        prod: 'true',
      },
    },
    spec: {
      description: secret.description,
      decrypters: secret.audiences ?? [],
      ...(!!secret.value ? { value: secret.value } : undefined),
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
      audiences:
        secret.audiences?.map((audience) => {
          if (audience in DECRYPT_ALLOW_LIST_LABEL_MAP) {
            return { label: DECRYPT_ALLOW_LIST_LABEL_MAP[audience as AllowedDecrypter], value: audience };
          }

          return { label: `Unsupported (${audience})`, value: audience };
        }) ?? [],
    };
  }
}

export function secretFormValuesToSecret(secretFormValues: SecretFormValues): NewSecret | Secret {
  const audiences = secretFormValues.audiences?.map((audience) => audience.value) ?? [];
  const secret = {
    ...secretFormValues,
    audiences,
  };

  if (!!secretFormValues.uid) {
    return secret as Secret;
  }

  return secret as NewSecret;
}

export function isSecretPending(secret: Secret): boolean {
  return secret.status === SecretStatusPhase.Pending;
}

export function validateSecretName(value: string): true | string {
  if (value.length < 1) {
    return t('secrets-management.form.name.error.required', 'Name is required');
  }

  if (value.length > SUBDOMAIN_MAX_LENGTH) {
    return t('secrets-management.form.name.error.too-long', 'Name must be less than {{maxLength}} characters', {
      maxLength: SUBDOMAIN_MAX_LENGTH,
    });
  }

  if (!RegExp(/^[a-z\d][a-z\d.-]*$/).test(value)) {
    return t(
      'secrets-management.form.name.error.invalid',
      'Name must start with a letter or number and can only contain letters, numbers, dashes, and periods'
    );
  }

  return true;
}

export function validateSecretDescription(value: string): true | string {
  if (value.length < 1) {
    return 'Description is required';
  }

  if (value.length > 253) {
    return 'Description must be less than 253 characters';
  }

  return true;
}

export function validateSecretValue(value: string | undefined): true | string {
  if (value === undefined) {
    // The assumption is that the value is already set and that the secret is being updated without changing the value
    return true;
  }

  if (value.length < 1) {
    return 'Value is required';
  }

  return true;
}
