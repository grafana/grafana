import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { Alert, Button, HorizontalGroup, Icon, IconButton, Input, Spinner, Text, TextLink, useStyles2, VerticalGroup, } from '@grafana/ui';
import { getFeedbackMessage } from './GenAIPanelTitleButton';
import { GenerationHistoryCarousel } from './GenerationHistoryCarousel';
import { QuickFeedback } from './QuickFeedback';
import { StreamStatus, useOpenAIStream } from './hooks';
import { AutoGenerateItem, reportAutoGenerateInteraction } from './tracking';
import { OPEN_AI_MODEL, QuickFeedbackType, sanitizeReply } from './utils';
const temperature = 0.5;
export const GenAIHistory = ({ eventTrackingSrc, history, messages, onApplySuggestion, updateHistory, }) => {
    const styles = useStyles2(getStyles);
    const [currentIndex, setCurrentIndex] = useState(1);
    const [showError, setShowError] = useState(false);
    const [customFeedback, setCustomPrompt] = useState('');
    const { setMessages, reply, streamStatus, error } = useOpenAIStream(OPEN_AI_MODEL, temperature);
    const isStreamGenerating = streamStatus === StreamStatus.GENERATING;
    const reportInteraction = (item, otherMetadata) => reportAutoGenerateInteraction(eventTrackingSrc, item, otherMetadata);
    useEffect(() => {
        if (!isStreamGenerating && reply !== '') {
            setCurrentIndex(1);
        }
    }, [isStreamGenerating, reply]);
    useEffect(() => {
        if (streamStatus === StreamStatus.COMPLETED) {
            updateHistory(sanitizeReply(reply));
        }
    }, [streamStatus, reply, updateHistory]);
    useEffect(() => {
        if (error) {
            setShowError(true);
        }
        if (streamStatus === StreamStatus.GENERATING) {
            setShowError(false);
        }
    }, [error, streamStatus]);
    const onSubmitCustomFeedback = (text) => {
        onGenerateWithFeedback(text);
        reportInteraction(AutoGenerateItem.customFeedback, { customFeedback: text });
    };
    const onApply = () => {
        onApplySuggestion(history[currentIndex - 1]);
    };
    const onNavigate = (index) => {
        setCurrentIndex(index);
        reportInteraction(index > currentIndex ? AutoGenerateItem.backHistoryItem : AutoGenerateItem.forwardHistoryItem);
    };
    const onGenerateWithFeedback = (suggestion) => {
        if (suggestion !== QuickFeedbackType.Regenerate) {
            messages = [...messages, ...getFeedbackMessage(history[currentIndex], suggestion)];
        }
        setMessages(messages);
        if (suggestion in QuickFeedbackType) {
            reportInteraction(AutoGenerateItem.quickFeedback, { quickFeedbackItem: suggestion });
        }
    };
    const onKeyDownCustomFeedbackInput = (e) => e.key === 'Enter' && onSubmitCustomFeedback(customFeedback);
    const onChangeCustomFeedback = (e) => setCustomPrompt(e.currentTarget.value);
    const onClickSubmitCustomFeedback = () => onSubmitCustomFeedback(customFeedback);
    const onClickDocs = () => reportInteraction(AutoGenerateItem.linkToDocs);
    return (React.createElement("div", { className: styles.container },
        showError && (React.createElement("div", null,
            React.createElement(Alert, { title: "" },
                React.createElement(VerticalGroup, null,
                    React.createElement("div", null, "Sorry, I was unable to complete your request. Please try again."))))),
        React.createElement(Input, { placeholder: "Tell AI what to do next...", suffix: React.createElement(IconButton, { name: "corner-down-right-alt", variant: "secondary", "aria-label": "Send custom feedback", onClick: onClickSubmitCustomFeedback, disabled: customFeedback === '' }), value: customFeedback, onChange: onChangeCustomFeedback, onKeyDown: onKeyDownCustomFeedbackInput }),
        React.createElement("div", { className: styles.actions },
            React.createElement(QuickFeedback, { onSuggestionClick: onGenerateWithFeedback, isGenerating: isStreamGenerating }),
            React.createElement(GenerationHistoryCarousel, { history: history, index: currentIndex, onNavigate: onNavigate, reply: sanitizeReply(reply), streamStatus: streamStatus })),
        React.createElement("div", { className: styles.applySuggestion },
            React.createElement(HorizontalGroup, { justify: 'flex-end' },
                isStreamGenerating && React.createElement(Spinner, null),
                React.createElement(Button, { onClick: onApply, disabled: isStreamGenerating }, "Apply"))),
        React.createElement("div", { className: styles.footer },
            React.createElement(Icon, { name: "exclamation-circle", "aria-label": "exclamation-circle", className: styles.infoColor }),
            React.createElement(Text, { variant: "bodySmall", color: "secondary" },
                "This content is AI-generated.",
                ' ',
                React.createElement(TextLink, { variant: "bodySmall", href: "https://grafana.com/grafana/dashboards/", external: true, onClick: onClickDocs }, "Learn more")))));
};
const getStyles = (theme) => ({
    container: css({
        display: 'flex',
        flexDirection: 'column',
        width: 520,
        // This is the space the footer height
        paddingBottom: 35,
    }),
    applySuggestion: css({
        marginTop: theme.spacing(1),
    }),
    actions: css({
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
    }),
    footer: css({
        // Absolute positioned since Toggletip doesn't support footer
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        margin: 0,
        padding: theme.spacing(1),
        paddingLeft: theme.spacing(2),
        alignItems: 'center',
        gap: theme.spacing(1),
        borderTop: `1px solid ${theme.colors.border.weak}`,
        marginTop: theme.spacing(2),
    }),
    infoColor: css({
        color: theme.colors.info.main,
    }),
});
//# sourceMappingURL=GenAIHistory.js.map