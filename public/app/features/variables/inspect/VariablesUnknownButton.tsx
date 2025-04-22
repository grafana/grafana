import { useMemo } from 'react';

import { IconButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { NetworkGraphModal } from './NetworkGraphModal';
import { UsagesToNetwork } from './utils';

interface Props {
  id: string;
  usages: UsagesToNetwork[];
}

export const VariablesUnknownButton = ({ id, usages }: Props) => {
  const network = useMemo(() => usages.find((n) => n.variable.id === id), [id, usages]);

  if (!network) {
    return null;
  }

  const nodes = network.nodes.map((n) => {
    if (n.label.includes(`$${id}`)) {
      return { ...n, color: '#FB7E81' };
    }
    return n;
  });

  return (
    <NetworkGraphModal
      show={false}
      title={t('variables.variables-unknown-button.usage-title', 'Showing usages for: {{variableId}}', {
        variableId: `$${id}`,
      })}
      nodes={nodes}
      edges={network.edges}
    >
      {({ showModal }) => {
        return (
          <IconButton
            onClick={() => showModal()}
            name="code-branch"
            tooltip={t('variables.variables-unknown-button.VariablesUnknownButton-tooltip-show-usages', 'Show usages')}
            data-testid="VariablesUnknownButton"
          />
        );
      }}
    </NetworkGraphModal>
  );
};
