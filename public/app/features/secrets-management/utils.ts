import { CreateSecretPayload, Secret, SecretsListResponse, SecretsListResponseItem } from './types';

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
    audiences: subject.spec.audiences,
    keeper: subject.spec.keeper,
    uid: subject.metadata.uid,
  };
}

export function transformFromSecret(
  secret: Partial<Secret> & { value?: string }
): CreateSecretPayload | Omit<CreateSecretPayload, CreateSecretPayload['spec']['value']> {
  console.log('value', secret.value, typeof secret.value);
  return {
    metadata: {
      name: secret.name,
    },
    spec: {
      title: secret.description,
      audiences: secret.audiences ?? ['test/default'],
      keeper: secret.keeper ?? 'default',
      ...(!!secret.value ? { value: secret.value } : { ref: 'unknown-what-this-should-be' }),
    },
  };
}
