import { css, cx } from '@emotion/css';
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DropResult,
  Droppable,
  DroppableProvided,
} from '@hello-pangea/dnd';
import { produce } from 'immer';
import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, Badge, Button, Field, Icon, Input, Label, Stack, useStyles2, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRulesSourceSymbol, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { UpdateGroupDelta, useUpdateRuleGroup } from '../hooks/ruleGroup/useUpdateRuleGroup';
import { useFolder } from '../hooks/useFolder';
import { SwapOperation, swapItems } from '../reducers/ruler/ruleGroups';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../rule-editor/formDefaults';
import { ruleGroupIdentifierV2toV1 } from '../utils/groupIdentifier';
import { stringifyErrorLike } from '../utils/misc';
import { createListFilterLink, groups } from '../utils/navigation';
import { hashRulerRule } from '../utils/rule-id';
import {
  getNumberEvaluationsToStartAlerting,
  getRuleName,
  isAlertingRulerRule,
  isGrafanaRulerRule,
} from '../utils/rules';

interface GroupEditFormProps {
  rulerGroup: RulerRuleGroupDTO;
  groupIdentifier: RuleGroupIdentifierV2;
}

interface GroupEditFormData {
  name: string;
  interval: string;
  namespace?: string;
}

function GroupEditForm({ rulerGroup, groupIdentifier }: GroupEditFormProps) {
  const [updateRuleGroup] = useUpdateRuleGroup();
  const groupIntervalOrDefault = rulerGroup?.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL;
  const [operations, setOperations] = useState<SwapOperation[]>([]);

  const {
    register,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<GroupEditFormData>({
    defaultValues: {
      name: rulerGroup.name,
      interval: rulerGroup.interval,
      namespace: groupIdentifier.groupOrigin === 'datasource' ? groupIdentifier.namespace.name : undefined,
    },
  });

  const onSwap = useCallback((swapOperation: SwapOperation) => {
    setOperations((prevOperations) => {
      return produce(prevOperations, (draft) => {
        draft.push(swapOperation);
      });
    });
  }, []);

  const onSubmit: SubmitHandler<GroupEditFormData> = async (data) => {
    const changeDelta: UpdateGroupDelta = {
      namespaceName: dirtyFields.namespace ? data.namespace : undefined,
      groupName: dirtyFields.name ? data.name : undefined,
      interval: dirtyFields.interval ? data.interval : undefined,
      ruleSwaps: operations.length ? operations : undefined,
    };

    await updateRuleGroup.execute(ruleGroupIdentifierV2toV1(groupIdentifier), changeDelta);
    if (groupIdentifier.groupOrigin === 'datasource') {
      const groupName = changeDelta.groupName ?? groupIdentifier.groupName;
      const namespaceName = changeDelta.namespaceName ?? groupIdentifier.namespace.name;
      locationService.replace(groups.editPageLink(groupIdentifier.rulesSource.uid, namespaceName, groupName));
    } else {
      if (changeDelta.groupName) {
        locationService.replace(groups.editPageLink('grafana', groupIdentifier.namespace.uid, changeDelta.groupName));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} id="group-edit-form">
      {groupIdentifier.groupOrigin === 'datasource' && (
        <Field label="Namespace">
          <Input id="namespace" {...register('namespace')} />
        </Field>
      )}
      <Field label="Evaluation group name">
        <Input id="group-name" {...register('name')} />
      </Field>
      <Field label="Evaluation interval" description="How often is the group evaluated">
        <Input id="interval" {...register('interval')} />
      </Field>
      <DraggableRulesTable rules={rulerGroup.rules} groupInterval={groupIntervalOrDefault} onSwap={onSwap} />
    </form>
  );
}

interface DraggableRulesTableProps {
  rules: RulerRuleDTO[];
  groupInterval: string;
  onSwap: (swapOperation: SwapOperation) => void;
}

function DraggableRulesTable({ rules, groupInterval, onSwap }: DraggableRulesTableProps) {
  const styles = useStyles2(getStyles);
  const [rulesList, setRulesList] = useState<RulerRuleDTO[]>(rules);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      // check for no-ops so we don't update the group unless we have changes
      if (!result.destination) {
        return;
      }

      const swapOperation: SwapOperation = [result.source.index, result.destination.index];

      onSwap(swapOperation);

      // re-order the rules list for the UI rendering
      const newOrderedRules = produce(rulesList, (draft) => {
        swapItems(draft, swapOperation);
      });
      setRulesList(newOrderedRules);
    },
    [rulesList, onSwap]
  );

  const rulesWithUID = useMemo(() => {
    return rulesList.map((rulerRule) => ({ ...rulerRule, uid: hashRulerRule(rulerRule) }));
  }, [rulesList]);

  return (
    <div>
      <Label description="Drag rules to reorder">Alerting and recording rules</Label>
      <ListItem
        ruleName="Rule name"
        pendingPeriod="Pending period"
        evalsToStartAlerting="Evaluations to start alerting"
        className={styles.listHeader}
      />
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable
          droppableId="alert-list"
          mode="standard"
          renderClone={(provided, _snapshot, rubric) => (
            <DraggableListItem
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
                    <DraggableListItem key={rule.uid} provided={provided} rule={rule} groupInterval={groupInterval} />
                  )}
                </Draggable>
              ))}
              {droppableProvided.placeholder}
            </Stack>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

interface DraggableListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  provided: DraggableProvided;
  rule: RulerRuleDTO;
  groupInterval: string;
  isClone?: boolean;
  isDragging?: boolean;
}

const DraggableListItem = ({
  provided,
  rule,
  groupInterval,
  isClone = false,
  isDragging = false,
}: DraggableListItemProps) => {
  // const styles = useStyles2(getStyles);

  // @TODO does this work with Grafana-managed recording rules too? Double check that.
  const ruleName = getRuleName(rule);
  const pendingPeriod = isAlertingRulerRule(rule) || isGrafanaRulerRule(rule) ? rule.for : null;
  const numberEvaluationsToStartAlerting =
    isAlertingRulerRule(rule) || isGrafanaRulerRule(rule)
      ? getNumberEvaluationsToStartAlerting(pendingPeriod ?? '0s', groupInterval)
      : null;

  // TODO Bring back isClone and isDraggin styles
  return (
    <ListItem
      dragHandle={<Icon name="draggabledots" />}
      ruleName={ruleName}
      pendingPeriod={pendingPeriod}
      evalsToStartAlerting={numberEvaluationsToStartAlerting ?? <Badge text="Recording" color="purple" />}
      data-testid="reorder-alert-rule"
      // className={cx(styles.listItem, isClone && 'isClone', isDragging && 'isDragging')}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    />
  );
};

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  dragHandle?: React.ReactNode;
  ruleName: React.ReactNode;
  pendingPeriod: React.ReactNode;
  evalsToStartAlerting: React.ReactNode;
}

const ListItem = forwardRef<HTMLDivElement, ListItemProps>(
  ({ dragHandle, ruleName, pendingPeriod, evalsToStartAlerting, className, ...props }, ref) => {
    const styles = useStyles2(getStyles);

    return (
      <div className={cx(styles.listItem, className)} ref={ref} {...props}>
        <Stack flex="0 0 24px">{dragHandle}</Stack>
        <Stack flex={1}>{ruleName}</Stack>
        <Stack basis="30%">{pendingPeriod}</Stack>
        <Stack basis="30%">{evalsToStartAlerting}</Stack>
      </div>
    );
  }
);

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
  listHeader: css({
    fontWeight: theme.typography.fontWeightBold,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
});

function GroupActions() {
  return (
    <Stack>
      <Button type="submit" form="group-edit-form">
        Save
      </Button>
      <Button variant="secondary" onClick={() => locationService.getHistory().goBack()}>
        Cancel
      </Button>
    </Stack>
  );
}

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
    text: 'Edit rule group',
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

  const groupIdentifier: RuleGroupIdentifierV2 =
    sourceId === 'grafana'
      ? {
          namespace: { uid: namespaceId },
          groupName: groupName,
          groupOrigin: 'grafana',
        }
      : {
          rulesSource: { uid: sourceId, name: dsFeatures?.name ?? '', ruleSourceType: 'datasource' },
          namespace: { name: namespaceId },
          groupName: groupName,
          groupOrigin: 'datasource',
        };

  return (
    <AlertingPageWrapper
      pageNav={pageNav}
      title="Edit evaluation group"
      navId="alert-list"
      isLoading={isLoading}
      actions={<GroupActions />}
    >
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
      {!isLoading && rulerGroup && <GroupEditForm rulerGroup={rulerGroup} groupIdentifier={groupIdentifier} />}
    </AlertingPageWrapper>
  );
}

export default withErrorBoundary(GroupEditPage, { style: 'page' });
