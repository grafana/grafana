import { css } from '@emotion/css';
import cx from 'classnames';
import React, { FC, useCallback } from 'react';
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  Droppable,
  DroppableProvided,
  DropResult,
} from 'react-beautiful-dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, Modal, Tooltip, useStyles2 } from '@grafana/ui';
import { CombinedRule, CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';

import { isCloudRulesSource } from '../../utils/datasource';
import { hashRulerRule } from '../../utils/rule-id';
import { isAlertingRule, isRecordingRule } from '../../utils/rules';

import { AlertStateTag } from './AlertStateTag';

interface ModalProps {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  onClose: () => void;
}

type CombinedRuleWithUID = { uid: string } & CombinedRule;

export const ReorderCloudGroupModal: FC<ModalProps> = (props) => {
  const { group, namespace, onClose } = props;
  const styles = useStyles2(getStyles);

  const onDragEnd = useCallback((result: DropResult) => {
    console.log(result);
  }, []);

  // assign unique but stable identifiers to each (alerting / recording) rule
  const rulesWithUID: CombinedRuleWithUID[] = group.rules.map((rule) => ({
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
              className={styles.listContainer}
              {...droppableProvided.droppableProps}
            >
              {rulesWithUID.map((rule, index) => (
                <Draggable key={rule.uid} draggableId={rule.uid} index={index}>
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
}

const ListItem = ({ provided, rule, isClone = false }: ListItemProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div
      className={cx(styles.listItem, isClone && 'isClone')}
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

const ModalHeader: FC<ModalHeaderProps> = ({ namespace, group }) => {
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
  modal: css`
    max-width: 640px;
    max-height: 80%;
    overflow: hidden;
  `,
  listItem: css`
    display: flex;
    flex-direction: row;
    align-items: center;

    gap: ${theme.spacing()};

    background: ${theme.colors.background.primary};
    color: ${theme.colors.text.secondary};

    border-bottom: solid 1px ${theme.colors.border.medium};
    padding: ${theme.spacing(1)} ${theme.spacing(2)};

    &:last-child {
      border-bottom: none;
    }

    &.isClone {
      border: solid 1px ${theme.colors.border.medium};
    }
  `,
  listContainer: css`
    border: solid 1px ${theme.colors.border.medium};
  `,
  listItemName: css`
    flex: 1;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  header: css`
    display: flex;
    align-items: center;

    gap: ${theme.spacing(1)};
  `,
  dataSourceIcon: css`
    width: ${theme.spacing(2)};
    height: ${theme.spacing(2)};
  `,
});
