import { HTMLProps, ReactNode } from 'react';
import { FieldPath } from 'react-hook-form';

import { AllowedDecrypter } from './constants';

export enum SecretStatusPhase {
  Succeeded = 'Succeeded',
  Pending = 'Pending',
  Failed = 'Failed',
}

interface SecretStatus {
  phase: SecretStatusPhase;
  message?: string; // Only applicable if the phase is `Failed`
}

interface MetaDataAnnotations {
  'grafana.app/createdBy'?: string;
  'grafana.app/updatedBy'?: string;
  'grafana.app/updatedTimestamp'?: string;
}

interface Metadata {
  creationTimestamp: string;
  name: string;
  namespace: string;
  resourceVersion: string;
  uid: string;
  annotations?: MetaDataAnnotations;
  labels?: Record<string, string>;
}

export interface SecretsListResponseItem {
  apiVersion: string;
  kind: 'SecureValue';
  metadata: Metadata;
  spec: {
    decrypters: AllowedDecrypter[] | null;
    description: string;
    keeper?: string;
  };
  status?: SecretStatus;
}

type Decrypter = string;

export type SecretPayload = CreateSecretPayload | UpdateSecretPayload;

export interface CreateSecretPayload {
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };

  spec: {
    description: string;
    value: string;
    decrypters?: Decrypter[];
  };
}

export interface UpdateSecretPayload {
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };

  spec: {
    description: string;
    value?: string;
    decrypters?: Decrypter[];
  };
}

export interface SecretsListResponse {
  kind: 'SecureValueList';
  apiVersion: string;
  metadata: {};
  items?: SecretsListResponseItem[];
}

export interface Secret {
  name: SecretsListResponseItem['metadata']['name'];
  description: SecretsListResponseItem['spec']['description'];
  decrypters: SecretsListResponseItem['spec']['decrypters'];
  uid: SecretsListResponseItem['metadata']['uid'];
  created: SecretsListResponseItem['metadata']['creationTimestamp'];
  labels: Array<{ name: string; value: string }>;
  keeper?: SecretsListResponseItem['spec']['keeper'];
  status?: SecretStatus['phase'];
  createdBy?: MetaDataAnnotations['grafana.app/createdBy'];
  modified?: MetaDataAnnotations['grafana.app/updatedTimestamp'];
  modifiedBy?: MetaDataAnnotations['grafana.app/updatedBy'];
}

export interface SecretFormValues {
  name: string;
  description: string;
  decrypters: Array<{ label: string; value: string }>;
  labels: Array<{ name: string; value: string }>;
  uid?: string;
  keeper?: string;
  value?: string;
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

export type FieldErrorMap = Partial<Record<FieldPath<SecretFormValues>, { message: string }>>;
