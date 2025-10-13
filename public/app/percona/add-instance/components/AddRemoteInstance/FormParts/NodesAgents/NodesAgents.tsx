import { FC, useCallback, useEffect, useMemo } from 'react';
import { useField } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/add-instance/components/AddRemoteInstance/FormParts/FormParts.messages';
import { getStyles } from 'app/percona/add-instance/components/AddRemoteInstance/FormParts/FormParts.styles';
import {
  PMM_SERVER_NODE_AGENT_ID,
  PMM_SERVER_NODE_ID,
} from 'app/percona/add-instance/components/AddRemoteInstance/FormParts/NodesAgents/NodesAgents.constants';
import { NodesAgentsProps } from 'app/percona/add-instance/components/AddRemoteInstance/FormParts/NodesAgents/NodesAgents.types';
import { GET_NODES_CANCEL_TOKEN } from 'app/percona/inventory/Inventory.constants';
import { AgentsOption, NodesOption } from 'app/percona/inventory/Inventory.types';
import { SelectField } from 'app/percona/shared/components/Form/SelectFieldCore';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { nodesOptionsMapper } from 'app/percona/shared/core/reducers/nodes';
import { fetchNodesAction } from 'app/percona/shared/core/reducers/nodes/nodes';
import { getNodes } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

export const NodesAgents: FC<NodesAgentsProps> = ({ form }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useAppDispatch();
  const [generateToken] = useCancelToken();
  const { nodes } = useSelector(getNodes);
  const {
    input: { value: selectedNode },
  } = useField('node');

  const nodesOptions = useMemo<NodesOption[]>(() => nodesOptionsMapper(nodes), [nodes]);

  const loadData = useCallback(async () => {
    try {
      await dispatch(fetchNodesAction({ token: generateToken(GET_NODES_CANCEL_TOKEN) })).unwrap();
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeAgentValue = (value: AgentsOption) => {
    if (!form?.getState().values?.address) {
      if (value.label !== PMM_SERVER_NODE_AGENT_ID) {
        form?.change('address', 'localhost');
      } else {
        form?.change('address', '');
      }
    }
  };

  const setNodeAndAgent = (value: NodesOption) => {
    form?.change('node', value);

    let selectedAgent: AgentsOption | undefined;
    if (value.agents && value.agents?.length > 1) {
      selectedAgent = value.agents.find((item) => item.value === PMM_SERVER_NODE_AGENT_ID);
    } else if (value.agents && value.agents?.length === 1) {
      selectedAgent = value.agents[0];
    }
    if (selectedAgent) {
      form?.change('pmm_agent_id', selectedAgent);
      changeAgentValue(selectedAgent);
    } else {
      form?.change('pmm_agent_id', undefined);
    }
  };

  useEffect(() => {
    if (nodesOptions.length === 0) {
      loadData();
    } else if (!selectedNode) {
      // preselect pmm-server node
      const pmmServerNode = nodesOptions.find((node) => node.value === PMM_SERVER_NODE_ID);
      if (pmmServerNode) {
        setNodeAndAgent(pmmServerNode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesOptions]);

  return (
    <div className={styles.group}>
      <div className={styles.selectFieldWrapper}>
        <SelectField
          label={Messages.form.labels.nodesAgents.nodes}
          isSearchable={false}
          options={nodesOptions}
          name="node"
          id="nodes-selectbox"
          data-testid="nodes-selectbox"
          onChange={(event) => setNodeAndAgent(event as NodesOption)}
          className={styles.selectField}
          aria-label={Messages.form.labels.nodesAgents.nodes}
          validators={[validators.required]}
        />
      </div>
      <div className={styles.selectFieldWrapper}>
        <SelectField
          label={Messages.form.labels.nodesAgents.agents}
          isSearchable={false}
          disabled={!selectedNode || !selectedNode.agents || selectedNode.agents.length === 1}
          options={selectedNode?.agents || []}
          name="pmm_agent_id"
          data-testid="agents-selectbox"
          onChange={(event) => changeAgentValue(event as AgentsOption)}
          className={styles.selectField}
          aria-label={Messages.form.labels.nodesAgents.agents}
          validators={selectedNode ? [validators.required] : undefined}
        />
      </div>
    </div>
  );
};
