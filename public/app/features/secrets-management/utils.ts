import { SecretFormValues } from './components/SecretForm';
import { MOCKED_SECRET_KEEPER } from './constants';
import { CreateSecretPayload, NewSecret, Secret, SecretsListResponse, SecretsListResponseItem } from './types';

export function transformListResponse(response: SecretsListResponse): Secret[] {
  if (!response.items) {
    return [];
  }

  return response.items.filter((item): item is SecretsListResponseItem => 'kind' in item).map(transformToSecret);
}

export function transformToSecret(subject: SecretsListResponseItem): Secret {
  return {
    name: subject.metadata.name,
    description: subject.spec.title,
    audiences: subject.spec.decrypters,
    keeper: subject.spec.keeper,
    uid: subject.metadata.uid,
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
      title: secret.description,
      decrypters: secret.audiences ?? ['test/default'],
      keeper: secret.keeper ?? 'default',
      ...(!!secret.value ? { value: secret.value } : undefined),
    },
  };
}

export function secretToSecretFormValues(secret: Secret): SecretFormValues {
  return {
    uid: secret.uid,
    name: secret.name,
    description: secret.description,
    enabled: true,
    audiences: secret.audiences?.map((audience) => ({ label: audience, value: audience })) ?? [],
    keeper: secret.keeper,
  };
}

export function secretFormValuesToSecret(secretFormValues: SecretFormValues): NewSecret | Secret {
  const keeper = secretFormValues.keeper ?? MOCKED_SECRET_KEEPER;
  const audiences = secretFormValues.audiences?.map((audience) => audience.value) ?? [];
  const secret = {
    ...secretFormValues,
    audiences,
    keeper,
  };
  if (!!secretFormValues.uid) {
    return secret as Secret;
  }

  return secret as NewSecret;
}
