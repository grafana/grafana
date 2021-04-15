import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import React, { FC } from 'react';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

export const RuleListStateView: FC<Props> = ({ namespaces }) => {
  return (
    <>
      <p>Hello world {namespaces.length}</p>
    </>
  );
};
