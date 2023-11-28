import React, { useEffect, useState } from 'react';
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import getStyles from '../../styles';
const MAX_NO_OF_VISIBLE_LOG_GROUPS = 6;
export const SelectedLogGroups = ({ selectedLogGroups = [], onChange, maxNoOfVisibleLogGroups = MAX_NO_OF_VISIBLE_LOG_GROUPS, }) => {
    const styles = useStyles2(getStyles);
    const [showConfirm, setShowConfirm] = useState(false);
    const [visibleSelectecLogGroups, setVisibleSelectecLogGroups] = useState(selectedLogGroups.slice(0, MAX_NO_OF_VISIBLE_LOG_GROUPS));
    useEffect(() => {
        setVisibleSelectecLogGroups(selectedLogGroups.slice(0, maxNoOfVisibleLogGroups));
    }, [selectedLogGroups, maxNoOfVisibleLogGroups]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.selectedLogGroupsContainer },
            visibleSelectecLogGroups.map((lg) => (React.createElement(Button, { key: lg.arn, size: "sm", variant: "secondary", icon: "times", className: styles.removeButton, onClick: () => {
                    onChange(selectedLogGroups.filter((slg) => slg.arn !== lg.arn));
                } }, `${lg.name}${lg.accountLabel ? `(${lg.accountLabel})` : ''}`))),
            visibleSelectecLogGroups.length !== selectedLogGroups.length && (React.createElement(Button, { size: "sm", variant: "secondary", icon: "plus", fill: "outline", className: styles.removeButton, onClick: () => setVisibleSelectecLogGroups(selectedLogGroups) }, "Show all")),
            selectedLogGroups.length > 0 && (React.createElement(Button, { size: "sm", variant: "secondary", icon: "times", fill: "outline", className: styles.removeButton, onClick: () => setShowConfirm(true) }, "Clear selection"))),
        React.createElement(ConfirmModal, { isOpen: showConfirm, title: "Clear Log Group Selection", body: "Are you sure you want to clear all log groups?", confirmText: "Yes", dismissText: "No", icon: "exclamation-triangle", onConfirm: () => {
                setShowConfirm(false);
                onChange([]);
            }, onDismiss: () => setShowConfirm(false) })));
};
//# sourceMappingURL=SelectedLogGroups.js.map