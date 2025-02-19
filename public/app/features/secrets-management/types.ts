interface SecretsListEmptyResponseItem {
  metadata: { creationTimestamp: null };
  spec: { audiences: null; title: '' };
}

export interface SecretsListResponseItem {
  apiVersion: string;
  kind: 'SecureValue';
  metadata: {
    creationTimestamp: null;
    name: string;
    namespace: string;
    resourceVersion: string;
    uid: string;
  };
  spec: {
    decrypters: string[] | null;
    title: string;
    keeper: string;
  };
}

type Audiences = `${string}/${string}`;

// Minimum required fields to create a secret
export interface CreateSecretPayload {
  metadata: {
    name: string;
  };

  spec: {
    title: string;
    audiences: Audiences[];
    keeper: string;
    value: string;
  };
}

export type SecretRequestIdentifier = Secret['name'];

export interface SecretsListResponse {
  kind: 'SecureValueList';
  apiVersion: string;
  metadata: {};
  items?: Array<SecretsListEmptyResponseItem | SecretsListResponseItem>;
}

export interface Secret {
  name: SecretsListResponseItem['metadata']['name'];
  description: SecretsListResponseItem['spec']['title'];
  audiences: SecretsListResponseItem['spec']['decrypters'];
  keeper: SecretsListResponseItem['spec']['keeper'];
  uid: SecretsListResponseItem['metadata']['uid'];
  value?: string; // Only present when editing a secret
}

export interface NewSecret extends Omit<Secret, 'uid'> {
  uid: never;
  value: string;
}
