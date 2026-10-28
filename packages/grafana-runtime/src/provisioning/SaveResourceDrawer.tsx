import * as React from 'react';

/**
 * @alpha
 */
export interface SaveResourceDrawerResource {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    annotations?: Record<string, string | undefined>;
  };
  spec?: Record<string, unknown>;
}

/**
 * @alpha
 */
export interface SaveResourceDrawerBranchCommit {
  ref: string;
  urls?: Record<string, string>;
  repoType?: string;
  configuredBranch?: string;
  repoUrl?: string;
  prTitle?: string;
}

/**
 * @alpha
 */
export type SaveResourceDrawerProps = {
  resource: SaveResourceDrawerResource;
  title: string;
  successMessage?: string;
  readOnlyMessage?: string;
  branchPrefix?: string;
  onDismiss?: () => void;
  onWriteSuccess?: () => void;
  onBranchSuccess?: (data: SaveResourceDrawerBranchCommit) => void;
} & ({ action: 'create'; repositoryName: string } | { action: 'update' | 'delete'; repositoryName?: never });

type SaveResourceDrawerType = React.ComponentType<SaveResourceDrawerProps>;

let SaveResourceDrawerComponent: SaveResourceDrawerType | undefined;

/**
 * @internal
 */
export function setSaveResourceDrawer(component: SaveResourceDrawerType) {
  SaveResourceDrawerComponent = component;
}

/**
 * @alpha
 */
export function SaveResourceDrawer(props: SaveResourceDrawerProps) {
  if (SaveResourceDrawerComponent) {
    return <SaveResourceDrawerComponent {...props} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    return <div>@grafana/runtime SaveResourceDrawer is not set</div>;
  }

  return null;
}
