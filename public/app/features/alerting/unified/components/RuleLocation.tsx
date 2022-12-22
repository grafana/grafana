import React, { FC } from 'react';

import { Icon } from '@grafana/ui';

interface RuleLocationProps {
  namespace: string;
  group?: string;
}

const RuleLocation: FC<RuleLocationProps> = ({ namespace, group }) => {
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
