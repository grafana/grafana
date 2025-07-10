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
import { forwardRef, useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Icon, Stack, useStyles2 } from '@grafana/ui';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { SwapOperation, swapItems } from '../../reducers/ruler/ruleGroups';
import { hashRulerRule } from '../../utils/rule-id';
import { getNumberEvaluationsToStartAlerting, getRuleName, rulerRuleType } from '../../utils/rules';

interface DraggableRulesTableProps {
  rules: RulerRuleDTO[];
  groupInterval: string;
  onSwap: (swapOperation: SwapOperation) => void;
}

export function DraggableRulesTable({ rules, groupInterval, onSwap }: DraggableRulesTableProps) {
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
      <ListItem
        ruleName={t('alerting.draggable-rules-table.rule-name', 'Rule name')}
        pendingPeriod={t('alerting.draggable-rules-table.pending-period', 'Pending period')}
        evalsToStartAlerting={t(
          'alerting.draggable-rules-table.evals-to-start-alerting',
          'Evaluations to start alerting'
        )}
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
}

const DraggableListItem = ({ provided, rule, groupInterval, isClone = false }: DraggableListItemProps) => {
  const styles = useStyles2(getStyles);

  const ruleName = getRuleName(rule);
  const pendingPeriod = rulerRuleType.any.alertingRule(rule) ? rule.for : null;
  const numberEvaluationsToStartAlerting = getNumberEvaluationsToStartAlerting(pendingPeriod ?? '0s', groupInterval);
  const isRecordingRule = rulerRuleType.any.recordingRule(rule);

  return (
    <ListItem
      dragHandle={<Icon name="draggabledots" />}
      ruleName={ruleName}
      pendingPeriod={pendingPeriod}
      evalsToStartAlerting={
        isRecordingRule ? (
          <Badge text={t('alerting.draggable-rules-table.recording', 'Recording')} color="purple" />
        ) : (
          numberEvaluationsToStartAlerting
        )
      }
      data-testid="reorder-alert-rule"
      className={cx(styles.listItem, { [styles.listItemClone]: isClone })}
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
  listItemClone: css({
    border: `solid 1px ${theme.colors.primary.shade}`,
  }),
  listHeader: css({
    fontWeight: theme.typography.fontWeightBold,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
});
