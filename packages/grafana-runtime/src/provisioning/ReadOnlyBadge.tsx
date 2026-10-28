import * as React from 'react';

/**
 * @alpha
 */
export interface ReadOnlyBadgeProps {
  repoType?: string;
}

type ReadOnlyBadgeType = React.ComponentType<ReadOnlyBadgeProps>;

let ReadOnlyBadgeComponent: ReadOnlyBadgeType | undefined;

/**
 * @internal
 */
export function setReadOnlyBadge(component: ReadOnlyBadgeType) {
  ReadOnlyBadgeComponent = component;
}

/**
 * @alpha
 */
export function ReadOnlyBadge(props: ReadOnlyBadgeProps) {
  if (ReadOnlyBadgeComponent) {
    return <ReadOnlyBadgeComponent {...props} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    return <div>@grafana/runtime ReadOnlyBadge is not set</div>;
  }

  return null;
}
