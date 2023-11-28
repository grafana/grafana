import { css } from '@emotion/css';
import cx from 'classnames';
import { compact } from 'lodash';
import React, { useCallback, useState } from 'react';
import { DragDropContext, Draggable, Droppable, } from 'react-beautiful-dnd';
import { Badge, Icon, Modal, Tooltip, useStyles2 } from '@grafana/ui';
import { dispatch } from 'app/store/store';
import { updateRulesOrder } from '../../state/actions';
import { getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { hashRulerRule } from '../../utils/rule-id';
import { isAlertingRule, isRecordingRule } from '../../utils/rules';
import { AlertStateTag } from './AlertStateTag';
export const ReorderCloudGroupModal = (props) => {
    const { group, namespace, onClose } = props;
    const [pending, setPending] = useState(false);
    const [rulesList, setRulesList] = useState(group.rules);
    const styles = useStyles2(getStyles);
    const onDragEnd = useCallback((result) => {
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
        dispatch(updateRulesOrder({
            namespaceName: namespace.name,
            groupName: group.name,
            rulesSourceName: rulesSourceName,
            newRules: rulerRules,
        }))
            .unwrap()
            .finally(() => {
            setPending(false);
        });
    }, [group.name, namespace.name, namespace.rulesSource, rulesList]);
    // assign unique but stable identifiers to each (alerting / recording) rule
    const rulesWithUID = rulesList.map((rule) => (Object.assign(Object.assign({}, rule), { uid: String(hashRulerRule(rule.rulerRule)) })));
    return (React.createElement(Modal, { className: styles.modal, isOpen: true, title: React.createElement(ModalHeader, { namespace: namespace, group: group }), onDismiss: onClose, onClickBackdrop: onClose },
        React.createElement(DragDropContext, { onDragEnd: onDragEnd },
            React.createElement(Droppable, { droppableId: "alert-list", mode: "standard", renderClone: (provided, _snapshot, rubric) => (React.createElement(ListItem, { provided: provided, rule: rulesWithUID[rubric.source.index], isClone: true })) }, (droppableProvided) => (React.createElement("div", Object.assign({ ref: droppableProvided.innerRef, className: cx(styles.listContainer, pending && styles.disabled) }, droppableProvided.droppableProps),
                rulesWithUID.map((rule, index) => (React.createElement(Draggable, { key: rule.uid, draggableId: rule.uid, index: index, isDragDisabled: pending }, (provided) => React.createElement(ListItem, { key: rule.uid, provided: provided, rule: rule })))),
                droppableProvided.placeholder))))));
};
const ListItem = ({ provided, rule, isClone = false, isDragging = false }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", Object.assign({ className: cx(styles.listItem, isClone && 'isClone', isDragging && 'isDragging'), ref: provided.innerRef }, provided.draggableProps, provided.dragHandleProps),
        isAlertingRule(rule.promRule) && React.createElement(AlertStateTag, { state: rule.promRule.state }),
        isRecordingRule(rule.promRule) && React.createElement(Badge, { text: 'Recording', color: 'blue' }),
        React.createElement("div", { className: styles.listItemName }, rule.name),
        React.createElement(Icon, { name: 'draggabledots' })));
};
const ModalHeader = ({ namespace, group }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.header },
        React.createElement(Icon, { name: "folder" }),
        isCloudRulesSource(namespace.rulesSource) && (React.createElement(Tooltip, { content: namespace.rulesSource.name, placement: "top" },
            React.createElement("img", { alt: namespace.rulesSource.meta.name, className: styles.dataSourceIcon, src: namespace.rulesSource.meta.info.logos.small }))),
        React.createElement("span", null, namespace.name),
        React.createElement(Icon, { name: "angle-right" }),
        React.createElement("span", null, group.name)));
};
const getStyles = (theme) => ({
    modal: css `
    max-width: 640px;
    max-height: 80%;
    overflow: hidden;
  `,
    listItem: css `
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
      border: solid 1px ${theme.colors.primary.shade};
    }
  `,
    listContainer: css `
    user-select: none;
    border: solid 1px ${theme.colors.border.medium};
  `,
    disabled: css `
    opacity: 0.5;
    pointer-events: none;
  `,
    listItemName: css `
    flex: 1;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
    header: css `
    display: flex;
    align-items: center;

    gap: ${theme.spacing(1)};
  `,
    dataSourceIcon: css `
    width: ${theme.spacing(2)};
    height: ${theme.spacing(2)};
  `,
});
export function reorder(rules, startIndex, endIndex) {
    const result = Array.from(rules);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
}
//# sourceMappingURL=ReorderRuleGroupModal.js.map