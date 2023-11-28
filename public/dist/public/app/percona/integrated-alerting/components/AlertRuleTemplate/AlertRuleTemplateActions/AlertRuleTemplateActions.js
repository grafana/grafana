import { cx } from '@emotion/css';
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { IconButton, Tooltip, useStyles2 } from '@grafana/ui';
import { SourceDescription } from '../AlertRuleTemplate.types';
import { DeleteRuleTemplateModal } from '../DeleteRuleTemplateModal/DeleteRuleTemplateModal';
import { EditAlertRuleTemplateModal } from '../EditAlertRuleTemplateModal/EditAlertRuleTemplateModal';
import { getStyles } from './AlertRuleTemplateActions.styles';
const nonActionableSources = [SourceDescription.BUILT_IN, SourceDescription.USER_FILE, SourceDescription.SAAS];
export const AlertRuleTemplateActions = ({ template, getAlertRuleTemplates, }) => {
    const styles = useStyles2(getStyles);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const { source, yaml, name, summary } = template;
    const isActionDisabled = useMemo(() => nonActionableSources.includes(source), [source]);
    return (React.createElement("div", { className: styles.actionsWrapper },
        React.createElement(Tooltip, { placement: "top", content: "Create alert rule from this template" },
            React.createElement(Link, { to: `/alerting/new?returnTo=%2Falerting%2Falert-rule-templates&template=${template.name}`, className: styles.actionLink },
                React.createElement(IconButton, { "data-testid": "create-from-template-button", "aria-label": "Create from template", name: "plus", size: "lg", className: styles.button }))),
        React.createElement(Tooltip, { placement: "top", content: "Edit" },
            React.createElement(IconButton, { "data-testid": "edit-template-button", "aria-label": "Edit template", name: "pen", size: "lg", className: cx(styles.button, styles.editButton), disabled: isActionDisabled, onClick: () => setEditModalVisible(true) })),
        React.createElement(Tooltip, { placement: "top", content: "Delete" },
            React.createElement(IconButton, { "data-testid": "delete-template-button", "aria-label": "Delete template", name: "times", size: "xl", className: cx(styles.button), disabled: isActionDisabled, onClick: () => setDeleteModalVisible(true) })),
        React.createElement(EditAlertRuleTemplateModal, { yaml: yaml, name: name, summary: summary, isVisible: editModalVisible, setVisible: setEditModalVisible, getAlertRuleTemplates: getAlertRuleTemplates }),
        React.createElement(DeleteRuleTemplateModal, { template: template, setVisible: setDeleteModalVisible, getAlertRuleTemplates: getAlertRuleTemplates, isVisible: deleteModalVisible })));
};
//# sourceMappingURL=AlertRuleTemplateActions.js.map