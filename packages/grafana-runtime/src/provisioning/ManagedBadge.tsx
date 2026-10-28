import * as React from 'react';

/**
 * @alpha
 */
export interface ManagedBadgeProps {
  managerKind?: string;
  name?: string;
  isOrphaned?: boolean;
  repositoryName?: string;
  sourcePath?: string;
}

type ManagedBadgeType = React.ComponentType<ManagedBadgeProps>;

let ManagedBadgeComponent: ManagedBadgeType | undefined;

/**
 * @internal
 */
export function setManagedBadge(component: ManagedBadgeType) {
  ManagedBadgeComponent = component;
}

/**
 * @alpha
 */
export function ManagedBadge(props: ManagedBadgeProps) {
  if (ManagedBadgeComponent) {
    return <ManagedBadgeComponent {...props} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    return <div>@grafana/runtime ManagedBadge is not set</div>;
  }

  return null;
}
