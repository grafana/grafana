import { css } from '@emotion/css';
import React from 'react';
import { Text, useStyles2 } from '@grafana/ui';
import { MinimalisticPagination } from './MinimalisticPagination';
import { StreamStatus } from './hooks';
export const GenerationHistoryCarousel = ({ history, index, reply, streamStatus, onNavigate, }) => {
    const styles = useStyles2(getStyles);
    const historySize = history.length;
    const getHistoryText = () => {
        if (reply && streamStatus !== StreamStatus.IDLE) {
            return reply;
        }
        return history[index - 1];
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(MinimalisticPagination, { currentPage: index, numberOfPages: historySize, onNavigate: onNavigate, hideWhenSinglePage: true, className: styles.paginationWrapper }),
        React.createElement("div", { className: styles.contentWrapper },
            React.createElement(Text, { element: "p", color: "secondary" }, getHistoryText()))));
};
const getStyles = (theme) => ({
    paginationWrapper: css({
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 15,
    }),
    contentWrapper: css({
        display: 'flex',
        flexBasis: '100%',
        flexGrow: 3,
        whiteSpace: 'pre-wrap',
        marginTop: 20,
    }),
});
//# sourceMappingURL=GenerationHistoryCarousel.js.map