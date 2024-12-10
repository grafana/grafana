import { css } from '@emotion/css';
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DropResult,
  Droppable,
  DroppableProvided,
} from '@hello-pangea/dnd';
import cx from 'classnames';
import { produce } from 'immer';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Button, Icon, Modal, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { dispatch } from 'app/store/store';
import {
  CombinedRuleGroup,
  CombinedRuleNamespace,
  RuleGroupIdentifier,
  RulerDataSourceConfig,
} from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { useReorderRuleForRuleGroup } from '../../hooks/ruleGroup/useUpdateRuleGroup';
import { isLoading } from '../../hooks/useAsync';
import { SwapOperation, swapItems } from '../../reducers/ruler/ruleGroups';
import { fetchRulerRulesAction } from '../../state/actions';
import { isCloudRulesSource } from '../../utils/datasource';
import { hashRulerRule } from '../../utils/rule-id';
import {
  isAlertingRulerRule,
  isGrafanaRulerRule,
  isRecordingRulerRule,
  rulesSourceToDataSourceName,
} from '../../utils/rules';

interface ModalProps {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  onClose: () => void;
  folderUid?: string;
  rulerConfig: RulerDataSourceConfig;
}

type RulerRuleWithUID = { uid: string } & RulerRuleDTO;

export const ReorderCloudGroupModal = (props: ModalProps) => {
  const styles = useStyles2(getStyles);
  const { group, namespace, onClose, folderUid } = props;
  const [operations, setOperations] = useState<Array<[number, number]>>([]);

  const [reorderRulesInGroup, reorderState] = useReorderRuleForRuleGroup();
  const isUpdating = isLoading(reorderState);

  // The list of rules might have been filtered before we get to this reordering modal
  // We need to grab the full (unfiltered) list
  const { currentData: ruleGroup, isLoading: loadingRules } = alertRuleApi.endpoints.getRuleGroupForNamespace.useQuery(
    {
      rulerConfig: props.rulerConfig,
      namespace: folderUid ?? namespace.name,
      group: group.name,
    },
    { refetchOnMountOrArgChange: true }
  );

  const [rulesList, setRulesList] = useState<RulerRuleDTO[]>([]);

  useEffect(() => {
    if (ruleGroup) {
      setRulesList(ruleGroup?.rules);
    }
  }, [ruleGroup]);

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

  const updateRulesOrder = useCallback(async () => {
    const dataSourceName = rulesSourceToDataSourceName(namespace.rulesSource);

    const ruleGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName,
      groupName: group.name,
      namespaceName: folderUid ?? namespace.name,
    };

    await reorderRulesInGroup.execute(ruleGroupIdentifier, operations);
    // TODO: Remove once RTKQ is more prevalently used
    await dispatch(fetchRulerRulesAction({ rulesSourceName: dataSourceName }));
    onClose();
  }, [namespace.rulesSource, namespace.name, group.name, folderUid, reorderRulesInGroup, operations, onClose]);

  // assign unique but stable identifiers to each (alerting / recording) rule
  const rulesWithUID: RulerRuleWithUID[] = rulesList.map((rulerRule) => ({
    ...rulerRule,
    uid: hashRulerRule(rulerRule),
  }));

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title={<ModalHeader namespace={namespace} group={group} />}
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
      {loadingRules && 'Loading...'}
      {rulesWithUID.length > 0 && (
        <>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable
              droppableId="alert-list"
              mode="standard"
              renderClone={(provided, _snapshot, rubric) => (
                <ListItem provided={provided} rule={rulesWithUID[rubric.source.index]} isClone />
              )}
            >
              {(droppableProvided: DroppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  className={cx(styles.listContainer, isUpdating && styles.disabled)}
                  {...droppableProvided.droppableProps}
                >
                  {rulesWithUID.map((rule, index) => (
                    <Draggable key={rule.uid} draggableId={rule.uid} index={index} isDragDisabled={isUpdating}>
                      {(provided: DraggableProvided) => <ListItem key={rule.uid} provided={provided} rule={rule} />}
                    </Draggable>
                  ))}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={onClose}>
              <Trans i18nKey={'common.cancel'}>Cancel</Trans>
            </Button>
            <Button onClick={() => updateRulesOrder()} disabled={isUpdating}>
              <Trans i18nKey={'common.save'}>Save</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </Modal>
  );
};

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  provided: DraggableProvided;
  rule: RulerRuleDTO;
  isClone?: boolean;
  isDragging?: boolean;
}

const ListItem = ({ provided, rule, isClone = false, isDragging = false }: ListItemProps) => {
  const styles = useStyles2(getStyles);

  // @TODO does this work with Grafana-managed recording rules too? Double check that.
  return (
    <div
      data-testid="reorder-alert-rule"
      className={cx(styles.listItem, isClone && 'isClone', isDragging && 'isDragging')}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      {isGrafanaRulerRule(rule) && <div className={styles.listItemName}>{rule.grafana_alert.title}</div>}
      {isRecordingRulerRule(rule) && (
        <>
          <div className={styles.listItemName}>{rule.record}</div>
          <Badge text="Recording" color="purple" />
        </>
      )}
      {isAlertingRulerRule(rule) && <div className={styles.listItemName}>{rule.alert}</div>}
      <Icon name="draggabledots" />
    </div>
  );
};

interface ModalHeaderProps {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
}

const ModalHeader = ({ namespace, group }: ModalHeaderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.header}>
      <Icon name="folder" />
      {isCloudRulesSource(namespace.rulesSource) && (
        <Tooltip content={namespace.rulesSource.name} placement="top">
          <img
            alt={namespace.rulesSource.meta.name}
            className={styles.dataSourceIcon}
            src={namespace.rulesSource.meta.info.logos.small}
          />
        </Tooltip>
      )}
      <span>{namespace.name}</span>
      <Icon name="angle-right" />
      <span>{group.name}</span>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    maxWidth: '640px',
    maxHeight: '80%',
    overflow: 'hidden',
  }),
  listItem: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',

    gap: theme.spacing(),

    background: theme.colors.background.primary,
    color: theme.colors.text.secondary,

    borderBottom: `solid 1px ${theme.colors.border.medium}`,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,

    '&:last-child': {
      borderBottom: 'none',
    },

    '&.isClone': {
      border: `solid 1px ${theme.colors.primary.shade}`,
    },
  }),
  listContainer: css({
    userSelect: 'none',
    border: `solid 1px ${theme.colors.border.medium}`,
  }),
  disabled: css({
    opacity: '0.5',
    pointerEvents: 'none',
  }),
  listItemName: css({
    flex: 1,

    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',

    gap: theme.spacing(1),
  }),
  dataSourceIcon: css({
    width: theme.spacing(2),
    height: theme.spacing(2),
  }),
});
