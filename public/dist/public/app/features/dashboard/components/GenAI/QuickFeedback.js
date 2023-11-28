import { css } from '@emotion/css';
import React from 'react';
import { Button, useStyles2 } from '@grafana/ui';
import { QuickFeedbackType } from './utils';
export const QuickFeedback = ({ onSuggestionClick, isGenerating }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.quickSuggestionsWrapper },
        React.createElement(Button, { onClick: () => onSuggestionClick(QuickFeedbackType.Shorter), size: "sm", variant: "secondary", disabled: isGenerating }, QuickFeedbackType.Shorter),
        React.createElement(Button, { onClick: () => onSuggestionClick(QuickFeedbackType.MoreDescriptive), size: "sm", variant: "secondary", disabled: isGenerating }, QuickFeedbackType.MoreDescriptive),
        React.createElement(Button, { onClick: () => onSuggestionClick(QuickFeedbackType.Regenerate), size: "sm", variant: "secondary", disabled: isGenerating }, QuickFeedbackType.Regenerate)));
};
const getStyles = (theme) => ({
    quickSuggestionsWrapper: css({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        flexGrow: 1,
        gap: 8,
        paddingTop: 10,
    }),
});
//# sourceMappingURL=QuickFeedback.js.map