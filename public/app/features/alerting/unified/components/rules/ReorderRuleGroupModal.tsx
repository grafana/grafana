import { css } from '@emotion/css';
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  Droppable,
  DroppableProvided,
  DropResult,
} from '@hello-pangea/dnd';
import cx from 'classnames';
import { compact } from 'lodash';
import { useCallback, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, Modal, Tooltip, useStyles2 } from '@grafana/ui';
import { useCombinedRuleNamespaces } from 'app/features/alerting/unified/hooks/useCombinedRuleNamespaces';
import { dispatch } from 'app/store/store';
import { CombinedRule, CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';

import { updateRulesOrder } from '../../state/actions';
import { getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { hashRulerRule } from '../../utils/rule-id';
import { isAlertingRule, isRecordingRule } from '../../utils/rules';

import { AlertStateTag } from './AlertStateTag';

interface ModalProps {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  onClose: () => void;
  folderUid?: string;
}

type CombinedRuleWithUID = { uid: string } & CombinedRule;

export const ReorderCloudGroupModal = (props: ModalProps) => {
  const { group, namespace, onClose, folderUid } = props;

  // The list of rules might have been filtered before we get to this reordering modal
  // We need to grab the full (unfiltered) list so we are able to reorder via the API without
  // deleting any rules (as they otherwise would have been omitted from the payload)
  const unfilteredNamespaces = useCombinedRuleNamespaces();
  const matchedNamespace = unfilteredNamespaces.find(
    (ns) => ns.rulesSource === namespace.rulesSource && ns.name === namespace.name
  );
  const matchedGroup = matchedNamespace?.groups.find((g) => g.name === group.name);

  const [pending, setPending] = useState<boolean>(false);
  const [rulesList, setRulesList] = useState<CombinedRule[]>(matchedGroup?.rules || []);

  const styles = useStyles2(getStyles);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      // check for no-ops so we don't update the group unless we have changes
      if (!result.destination) {
        return;
      }

      const sameIndex = result.destination.index === result.source.index;
      if (sameIndex) {
        return;
      }

      const newOrderedRules = reorder(rulesList, result.source.index, result.destination.index);
      setRulesList(newOrderedRules); // optimistically update the new rules list

      const rulesSourceName = getRulesSourceName(namespace.rulesSource);
      const rulerRules = compact(newOrderedRules.map((rule) => rule.rulerRule));

      setPending(true);
      dispatch(
        updateRulesOrder({
          namespaceName: namespace.name,
          groupName: group.name,
          rulesSourceName: rulesSourceName,
          newRules: rulerRules,
          folderUid: folderUid || namespace.name,
        })
      )
        .unwrap()
        .finally(() => {
          setPending(false);
        });
    },
    [group.name, namespace.name, namespace.rulesSource, rulesList, folderUid]
  );

  // assign unique but stable identifiers to each (alerting / recording) rule
  const rulesWithUID: CombinedRuleWithUID[] = rulesList.map((rule) => ({
    ...rule,
    uid: String(hashRulerRule(rule.rulerRule!)), // TODO fix this coercion?
  }));

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title={<ModalHeader namespace={namespace} group={group} />}
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
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
              className={cx(styles.listContainer, pending && styles.disabled)}
              {...droppableProvided.droppableProps}
            >
              {rulesWithUID.map((rule, index) => (
                <Draggable key={rule.uid} draggableId={rule.uid} index={index} isDragDisabled={pending}>
                  {(provided: DraggableProvided) => <ListItem key={rule.uid} provided={provided} rule={rule} />}
                </Draggable>
              ))}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </Modal>
  );
};

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  provided: DraggableProvided;
  rule: CombinedRule;
  isClone?: boolean;
  isDragging?: boolean;
}

const ListItem = ({ provided, rule, isClone = false, isDragging = false }: ListItemProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div
      data-testid="reorder-alert-rule"
      className={cx(styles.listItem, isClone && 'isClone', isDragging && 'isDragging')}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      {isAlertingRule(rule.promRule) && <AlertStateTag state={rule.promRule.state} />}
      {isRecordingRule(rule.promRule) && <Badge text={'Recording'} color={'blue'} />}
      <div className={styles.listItemName}>{rule.name}</div>
      <Icon name={'draggabledots'} />
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

export function reorder<T>(rules: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(rules);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}
