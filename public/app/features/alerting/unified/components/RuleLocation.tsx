import React from 'react';

import { Icon } from '@grafana/ui';

interface Props {
  namespace: string;
  group?: string;
}

const RuleLocation = ({ namespace, group }: Props) => {
  if (!group) {
    return <>{namespace}</>;
  }

  return (
    <>
      {namespace} <Icon name="angle-right" /> {group}
    </>
  );
};

export { RuleLocation };
