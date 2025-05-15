import { SecretFormValues } from './components/SecretForm';
import { AllowedDecrypter, DECRYPT_ALLOW_LIST_LABEL_MAP } from './constants';
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
  };
}

export function transformFromSecret(
  secret: (Partial<Secret> & { value?: string }) | SecretFormValues
): CreateSecretPayload | Omit<CreateSecretPayload, CreateSecretPayload['spec']['value']> {
  return {
    metadata: {
      name: secret.name,
      ...(!!secret.uid ? { uid: secret.uid } : undefined),
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
      enabled: true,
      audiences:
        secret.audiences?.map((audience) => {
          if (audience in DECRYPT_ALLOW_LIST_LABEL_MAP) {
            return { label: DECRYPT_ALLOW_LIST_LABEL_MAP[audience as AllowedDecrypter], value: audience };
          }

          return { label: `Unsupported (${audience})`, value: audience };
        }) ?? [],
      keeper: secret.keeper,
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
