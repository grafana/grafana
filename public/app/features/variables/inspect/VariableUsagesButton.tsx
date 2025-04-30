import { useMemo } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { IconButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { NetworkGraphModal } from './NetworkGraphModal';
import { UsagesToNetwork } from './utils';

interface Props {
  id: string;
  usages: UsagesToNetwork[];
  isAdhoc: boolean;
}

export const VariableUsagesButton = ({ id, usages, isAdhoc }: Props) => {
  const network = useMemo(() => usages.find((n) => n.variable.id === id), [usages, id]);
  if (usages.length === 0 || isAdhoc || !network) {
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
      title={t('variabels.variable-usages-button.usage-title', 'Showing usages for: {{variableId}}', {
        variableId: `$${id}`,
      })}
      nodes={nodes}
      edges={network.edges}
    >
      {({ showModal }) => {
        return (
          <IconButton
            onClick={() => {
              reportInteraction('Show variable usages');
              showModal();
            }}
            name="code-branch"
            tooltip={t('variables.variable-usages-button.tooltip-show-usages', 'Show usages')}
          />
        );
      }}
    </NetworkGraphModal>
  );
};
