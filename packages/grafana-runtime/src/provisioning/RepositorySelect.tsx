import * as React from 'react';

/**
 * @alpha
 */
export interface RepositorySelectProps {
  group: string;
  kind: string;
  value?: string;
  onChange: (repositoryName: string) => void;
  readOnly?: boolean;
  description?: string;
  id?: string;
}

type RepositorySelectType = React.ComponentType<RepositorySelectProps>;

let RepositorySelectComponent: RepositorySelectType | undefined;

/**
 * @internal
 */
export function setRepositorySelect(component: RepositorySelectType) {
  RepositorySelectComponent = component;
}

/**
 * @alpha
 */
export function RepositorySelect(props: RepositorySelectProps) {
  if (RepositorySelectComponent) {
    return <RepositorySelectComponent {...props} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    return <div>@grafana/runtime RepositorySelect is not set</div>;
  }

  return null;
}
