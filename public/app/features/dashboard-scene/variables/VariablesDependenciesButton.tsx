import { css } from '@emotion/css';
import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { type SceneVariable, type SceneVariableState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { NetworkGraphModal } from 'app/features/variables/inspect/NetworkGraphModal';

import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';

interface Props {
  variables: Array<SceneVariable<SceneVariableState>>;
  isInSidebar?: boolean;
}

export const VariablesDependenciesButton = ({ variables, isInSidebar }: Props) => {
  const nodes = useMemo(() => createDependencyNodes(variables), [variables]);
  const edges = useMemo(() => createDependencyEdges(variables), [variables]);

  if (!edges.length) {
    return null;
  }

  return (
    <NetworkGraphModal
      show={false}
      title={t('dashboards.settings.variables.dependencies.title', 'Dependencies')}
      nodes={filterNodesWithDependencies(nodes, edges)}
      edges={edges}
    >
      {({ showModal }) => {
        return isInSidebar ? (
          <Button
            className={css({ width: '100%', justifyContent: 'center' })}
            icon="channel-add"
            size="sm"
            variant="secondary"
            onClick={() => {
              reportInteraction('Show variable dependencies');
              showModal();
            }}
            data-testid={selectors.components.PanelEditor.ElementEditPane.showDependenciesButton}
          >
            <Trans i18nKey="variables.variables-dependencies-button.show-dependencies">Show dependencies</Trans>
          </Button>
        ) : (
          <Button
            onClick={() => {
              reportInteraction('Show variable dependencies');
              showModal();
            }}
            icon="channel-add"
            variant="secondary"
          >
            <Trans i18nKey={'dashboards.settings.variables.dependencies.button'}>Show dependencies</Trans>
          </Button>
        );
      }}
    </NetworkGraphModal>
  );
};
