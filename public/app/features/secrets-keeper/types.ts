// Types for Secrets Keeper UI
// Based on backend K8s types in apps/secret/pkg/apis/secret/v1beta1/

export type KeeperType = 'aws' | 'azure' | 'gcp' | 'hashicorp' | 'system';

export type KeeperStatus = 'active' | 'inactive';

// Credential value can come from 3 sources
export interface CredentialValue {
  // From Grafana secure value store
  secureValueName?: string;
  // From environment variable
  valueFromEnv?: string;
  // From grafana.ini config file
  valueFromConfig?: string;
}

// AWS Keeper Configuration
export interface KeeperAWSConfig {
  region: string;
  accessKey?: {
    accessKeyID: CredentialValue;
    secretAccessKey: CredentialValue;
  };
  assumeRole?: {
    assumeRoleArn: string;
    externalID: string;
  };
  kmsKeyID?: string;
}

// Azure Keeper Configuration
export interface KeeperAzureConfig {
  keyVaultName: string;
  tenantID: string;
  clientID: string;
  clientSecret: CredentialValue;
}

// GCP Keeper Configuration
export interface KeeperGCPConfig {
  projectID: string;
  credentialsFile: string;
}

// HashiCorp Vault Keeper Configuration
export interface KeeperHashiCorpConfig {
  address: string;
  token: CredentialValue;
}

// Keeper Spec (discriminated union by type)
export interface KeeperSpec {
  description: string; // 1-253 characters
  aws?: KeeperAWSConfig;
  azure?: KeeperAzureConfig;
  gcp?: KeeperGCPConfig;
  hashiCorpVault?: KeeperHashiCorpConfig;
}

// K8s metadata (simplified for now)
export interface KeeperMetadata {
  name: string;
  namespace?: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

// Full Keeper object (K8s-style)
export interface Keeper {
  metadata: KeeperMetadata;
  spec: KeeperSpec;
  // Status fields (may be added by backend)
  isActive?: boolean;
}

// UI-specific keeper with computed fields
export interface KeeperListItem {
  name: string;
  type: KeeperType;
  description: string;
  isActive: boolean;
  createdAt?: string;
  // For display purposes
  config: string; // e.g., "us-east-1" for AWS, "my-vault" for Azure
}
