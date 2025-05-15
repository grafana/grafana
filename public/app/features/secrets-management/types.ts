import { HTMLProps, ReactNode } from 'react';

export enum SecretStatusPhase {
  Succeeded = 'Succeeded',
  Pending = 'Pending',
  Failed = 'Failed',
}

interface SecretStatus {
  phase: SecretStatusPhase;
  message?: string; // Only applicable if the phase is `Failed`
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
    description: string;
    keeper?: string;
  };
  status?: SecretStatus;
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
    value: string;
  };
}

export type SecretRequestIdentifier = Secret['name'];

export interface SecretsListResponse {
  kind: 'SecureValueList';
  apiVersion: string;
  metadata: {};
  items?: SecretsListResponseItem[];
}

export interface Secret {
  name: SecretsListResponseItem['metadata']['name'];
  description: SecretsListResponseItem['spec']['description'];
  audiences: SecretsListResponseItem['spec']['decrypters'];
  keeper?: SecretsListResponseItem['spec']['keeper'];
  uid: SecretsListResponseItem['metadata']['uid'];
  value?: string; // Only present when editing a secret
  status?: SecretStatus['phase'];
}

export interface NewSecret extends Omit<Secret, 'uid'> {
  uid: never;
  value: string;
}

// TypeScript doesn't like `import { Props as InputProps } from '@grafana/ui/src/components/Input/Input'`, this is a copy-paste of the InputProps interface
export interface InputProps extends Omit<HTMLProps<HTMLInputElement>, 'prefix' | 'size'> {
  /** Sets the width to a multiple of 8 px.
   * Should only be used with inline forms.
   * Setting the width of the container is preferred in other cases.*/
  width?: number;
  /** Show an invalid state around the input */
  invalid?: boolean;
  /** Show an icon as a prefix in the input */
  prefix?: ReactNode;
  /** Show an icon as a suffix in the input */
  suffix?: ReactNode;
  /** Show a loading indicator as a suffix in the input */
  loading?: boolean;
  /** Add a component as an addon before the input  */
  addonBefore?: ReactNode;
  /** Add a component as an addon after the input */
  addonAfter?: ReactNode;
}

// Helper types
export type Entries<T> = Array<
  {
    [K in keyof T]-?: [K, T[K]];
  }[keyof T]
>;
