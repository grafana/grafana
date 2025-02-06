import { css } from '@emotion/css';
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DropResult,
  Droppable,
  DroppableProvided,
} from '@hello-pangea/dnd';
import { produce } from 'immer';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Alert, Badge, Field, Icon, Input, Stack, useStyles2, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useFolder } from '../hooks/useFolder';
import { SwapOperation, swapItems } from '../reducers/ruler/ruleGroups';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../rule-editor/formDefaults';
import { stringifyErrorLike } from '../utils/misc';
import { createListFilterLink } from '../utils/navigation';
import { hashRulerRule } from '../utils/rule-id';
import {
  getNumberEvaluationsToStartAlerting,
  getRuleName,
  isAlertingRulerRule,
  isGrafanaRulerRule,
} from '../utils/rules';

interface GroupEditFormProps {
  rulerGroup: RulerRuleGroupDTO;
}

function GroupEditForm({ rulerGroup }: GroupEditFormProps) {
  const groupInterval = rulerGroup?.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL;

  return (
    <div>
      {rulerGroup && <div>{rulerGroup.interval ?? '<Not defined>'}</div>}
      <Field label="Interval" description="The interval at which the group is evaluated">
        <Input id="interval" defaultValue={groupInterval} />
      </Field>
      {rulerGroup && <DraggableRulesTable rules={rulerGroup.rules} groupInterval={groupInterval} />}
    </div>
  );
}

interface DraggableRulesTableProps {
  rules: RulerRuleDTO[];
  groupInterval: string;
}

function DraggableRulesTable({ rules, groupInterval }: DraggableRulesTableProps) {
  const [rulesList, setRulesList] = useState<RulerRuleDTO[]>(rules);
  const [operations, setOperations] = useState<Array<[number, number]>>([]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      // check for no-ops so we don't update the group unless we have changes
      if (!result.destination) {
        return;
      }

      const swapOperation: SwapOperation = [result.source.index, result.destination.index];

      // add old index and new index to the modifications object
      setOperations(
        produce(operations, (draft) => {
          draft.push(swapOperation);
        })
      );

      // re-order the rules list for the UI rendering
      const newOrderedRules = produce(rulesList, (draft) => {
        swapItems(draft, swapOperation);
      });
      setRulesList(newOrderedRules);
    },
    [rulesList, operations]
  );

  const rulesWithUID = useMemo(() => {
    return rulesList.map((rulerRule) => ({
      ...rulerRule,
      uid: hashRulerRule(rulerRule),
    }));
  }, [rulesList]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable
        droppableId="alert-list"
        mode="standard"
        renderClone={(provided, _snapshot, rubric) => (
          <ListItem
            provided={provided}
            rule={rulesWithUID[rubric.source.index]}
            isClone
            groupInterval={groupInterval}
          />
        )}
      >
        {(droppableProvided: DroppableProvided) => (
          <Stack direction="column" gap={0} ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
            {rulesWithUID.map((rule, index) => (
              <Draggable key={rule.uid} draggableId={rule.uid} index={index} isDragDisabled={false}>
                {(provided: DraggableProvided) => (
                  <ListItem key={rule.uid} provided={provided} rule={rule} groupInterval={groupInterval} />
                )}
              </Draggable>
            ))}
            {droppableProvided.placeholder}
          </Stack>
        )}
      </Droppable>
    </DragDropContext>
  );
}

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  provided: DraggableProvided;
  rule: RulerRuleDTO;
  groupInterval: string;
  isClone?: boolean;
  isDragging?: boolean;
}

const ListItem = ({ provided, rule, groupInterval, isClone = false, isDragging = false }: ListItemProps) => {
  const styles = useStyles2(getStyles);

  // @TODO does this work with Grafana-managed recording rules too? Double check that.
  const ruleName = getRuleName(rule);
  const pendingPeriod = isAlertingRulerRule(rule) || isGrafanaRulerRule(rule) ? rule.for : null;
  const numberEvaluationsToStartAlerting =
    isAlertingRulerRule(rule) || isGrafanaRulerRule(rule)
      ? getNumberEvaluationsToStartAlerting(pendingPeriod ?? '0s', groupInterval)
      : null;

  return (
    <div
      className={styles.listItem}
      data-testid="reorder-alert-rule"
      // className={cx(styles.listItem, isClone && 'isClone', isDragging && 'isDragging')}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <Icon name="draggabledots" />
      <Stack flex={1}>{ruleName}</Stack>
      <Stack basis="30%">{pendingPeriod}</Stack>
      <Stack basis="30%">{numberEvaluationsToStartAlerting ?? <Badge text="Recording" color="purple" />}</Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  listItem: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',

    gap: theme.spacing(1),
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,

    '&:nth-child(even)': {
      background: theme.colors.background.secondary,
    },
  }),
});

type GroupEditPageRouteParams = {
  sourceId?: string;
  namespaceId?: string;
  groupName?: string;
};

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;

function GroupEditPage() {
  const { sourceId = '', namespaceId = '', groupName = '' } = useParams<GroupEditPageRouteParams>();

  const { folder, loading: isFolderLoading } = useFolder(sourceId === 'grafana' ? namespaceId : '');

  const {
    data: dsFeatures,
    isLoading: isDsFeaturesLoading,
    error: dsFeaturesError,
  } = useDiscoverDsFeaturesQuery({ uid: sourceId === 'grafana' ? GrafanaRulesSourceSymbol : sourceId });

  const {
    data: rulerGroup,
    isLoading: isRuleGroupLoading,
    isUninitialized: isRuleGroupUninitialized,
    error: ruleGroupError,
  } = useGetRuleGroupForNamespaceQuery(
    {
      rulerConfig: dsFeatures?.rulerConfig!,
      namespace: namespaceId,
      group: groupName,
    },
    { skip: !dsFeatures?.rulerConfig }
  );

  const isLoading = isFolderLoading || isDsFeaturesLoading || isRuleGroupLoading || isRuleGroupUninitialized;

  const pageNav: NavModelItem = {
    text: groupName,
    parentItem: {
      text: folder?.title ?? namespaceId,
      url: createListFilterLink([
        ['namespace', folder?.title ?? namespaceId],
        ['group', groupName],
      ]),
    },
  };

  if (!!dsFeatures && !dsFeatures.rulerConfig) {
    return (
      <AlertingPageWrapper pageNav={pageNav} title={groupName} isLoading={isLoading}>
        <Alert title="Selected group cannot be edited">
          This group belongs to a data source that does not support editing.
        </Alert>
      </AlertingPageWrapper>
    );
  }

  return (
    <AlertingPageWrapper pageNav={pageNav} title={groupName} navId="alert-list" isLoading={isLoading}>
      <>
        {dsFeaturesError && (
          <Alert title="Error loading data source details" bottomSpacing={0} topSpacing={2}>
            <div>{stringifyErrorLike(dsFeaturesError)}</div>
          </Alert>
        )}
        {ruleGroupError && (
          <Alert title="Error loading rule group" bottomSpacing={0} topSpacing={2}>
            {stringifyErrorLike(ruleGroupError)}
          </Alert>
        )}
      </>
      {!isLoading && !rulerGroup && <EntityNotFound entity={`${namespaceId}/${groupName}`} />}
      {!isLoading && rulerGroup && <GroupEditForm rulerGroup={rulerGroup} />}
    </AlertingPageWrapper>
  );
}

export default withErrorBoundary(GroupEditPage, { style: 'page' });
