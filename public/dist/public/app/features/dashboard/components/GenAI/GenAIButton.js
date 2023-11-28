import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Spinner, useStyles2, Tooltip, Toggletip, Text } from '@grafana/ui';
import { GenAIHistory } from './GenAIHistory';
import { StreamStatus, useOpenAIStream } from './hooks';
import { AutoGenerateItem, reportAutoGenerateInteraction } from './tracking';
import { OPEN_AI_MODEL, sanitizeReply } from './utils';
export const GenAIButton = ({ text = 'Auto-generate', loadingText = 'Generating', toggleTipTitle = '', onClick: onClickProp, messages, onGenerate, temperature = 1, eventTrackingSrc, disabled, }) => {
    const styles = useStyles2(getStyles);
    const { setMessages, reply, value, error, streamStatus } = useOpenAIStream(OPEN_AI_MODEL, temperature);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(true);
    const hasHistory = history.length > 0;
    const isFirstHistoryEntry = streamStatus === StreamStatus.GENERATING && !hasHistory;
    const isButtonDisabled = disabled || isFirstHistoryEntry || (value && !value.enabled && !error);
    const reportInteraction = (item) => reportAutoGenerateInteraction(eventTrackingSrc, item);
    const onClick = (e) => {
        if (!hasHistory) {
            onClickProp === null || onClickProp === void 0 ? void 0 : onClickProp(e);
            setMessages(messages);
        }
        else {
            if (setShowHistory) {
                setShowHistory(true);
            }
        }
        const buttonItem = error
            ? AutoGenerateItem.erroredRetryButton
            : hasHistory
                ? AutoGenerateItem.improveButton
                : AutoGenerateItem.autoGenerateButton;
        reportInteraction(buttonItem);
    };
    const pushHistoryEntry = useCallback((historyEntry) => {
        if (history.indexOf(historyEntry) === -1) {
            setHistory([historyEntry, ...history]);
        }
    }, [history]);
    useEffect(() => {
        // Todo: Consider other options for `"` sanitation
        if (isFirstHistoryEntry && reply) {
            onGenerate(sanitizeReply(reply));
        }
    }, [streamStatus, reply, onGenerate, isFirstHistoryEntry]);
    useEffect(() => {
        if (streamStatus === StreamStatus.COMPLETED) {
            pushHistoryEntry(sanitizeReply(reply));
        }
    }, [history, streamStatus, reply, pushHistoryEntry]);
    // The button is disabled if the plugin is not installed or enabled
    if (!(value === null || value === void 0 ? void 0 : value.enabled)) {
        return null;
    }
    const onApplySuggestion = (suggestion) => {
        reportInteraction(AutoGenerateItem.applySuggestion);
        onGenerate(suggestion);
        setShowHistory(false);
    };
    const getIcon = () => {
        if (isFirstHistoryEntry) {
            return undefined;
        }
        if (error || (value && !(value === null || value === void 0 ? void 0 : value.enabled))) {
            return 'exclamation-circle';
        }
        return 'ai';
    };
    const getText = () => {
        let buttonText = text;
        if (error) {
            buttonText = 'Retry';
        }
        if (isFirstHistoryEntry) {
            buttonText = loadingText;
        }
        if (hasHistory) {
            buttonText = 'Improve';
        }
        return buttonText;
    };
    const button = (React.createElement(Button, { icon: getIcon(), onClick: onClick, fill: "text", size: "sm", disabled: isButtonDisabled, variant: error ? 'destructive' : 'primary' }, getText()));
    const renderButtonWithToggletip = () => {
        if (hasHistory) {
            const title = React.createElement(Text, { element: "p" }, toggleTipTitle);
            return (React.createElement(Toggletip, { title: title, content: React.createElement(GenAIHistory, { history: history, messages: messages, onApplySuggestion: onApplySuggestion, updateHistory: pushHistoryEntry, eventTrackingSrc: eventTrackingSrc }), placement: "bottom-start", fitContent: true, show: showHistory ? undefined : false }, button));
        }
        return button;
    };
    return (React.createElement("div", { className: styles.wrapper },
        isFirstHistoryEntry && React.createElement(Spinner, { size: 14 }),
        !hasHistory && (React.createElement(Tooltip, { show: error ? undefined : false, interactive: true, content: 'Failed to generate content using OpenAI. Please try again or if the problem persist, contact your organization admin.' }, button)),
        hasHistory && renderButtonWithToggletip()));
};
const getStyles = (theme) => ({
    wrapper: css({
        display: 'flex',
    }),
});
//# sourceMappingURL=GenAIButton.js.map