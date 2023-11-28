import React, { useState } from 'react';
import { Collapse, useStyles } from '@grafana/ui';
import { Label } from 'app/percona/shared/components/Form/Label';
import { Messages } from '../TemplateStep.messages';
import { getStyles } from './AdvancedRuleSection.styles';
export const AdvancedRuleSection = ({ expression, summary }) => {
    const styles = useStyles(getStyles);
    const [isAdvancedSectionOpen, setIsAdvancedSectionOpen] = useState(false);
    return (React.createElement("div", { "data-testid": "alert-rule-advanced-section" },
        React.createElement(Collapse, { label: Messages.advanced, collapsible: true, isOpen: isAdvancedSectionOpen, onToggle: () => setIsAdvancedSectionOpen((open) => !open) },
            React.createElement("div", { "data-testid": "template-expression", className: styles.templateParsedField },
                React.createElement(Label, { label: Messages.templateExpression }),
                React.createElement("pre", null, expression)),
            summary && (React.createElement("div", { "data-testid": "template-alert", className: styles.templateParsedField },
                React.createElement(Label, { label: Messages.ruleAlert }),
                React.createElement("pre", null, summary))))));
};
//# sourceMappingURL=AdvancedRuleSection.js.map