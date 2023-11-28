import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardButton, useStyles } from '@grafana/ui';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { LIMIT, LOGS_CANCEL_TOKEN, STREAM_INTERVAL } from './ChunkedLogsViewer.constants';
import { Messages } from './ChunkedLogsViewer.messages';
import { getStyles } from './ChunkedLogsViewer.styles';
export const ChunkedLogsViewer = ({ getLogChunks }) => {
    const [lastLog, setLastLog] = useState(false);
    const [logs, setLogs] = useState([]);
    const [triggerTimeout, , stopTimeout] = useRecurringCall();
    const [generateToken] = useCancelToken();
    const styles = useStyles(getStyles);
    const formatLogs = useCallback(() => logs.map((log) => log.data).reduce((acc, message) => `${acc}${acc.length ? '\n' : ''}${message}`, ''), [logs]);
    const refreshCurrentLogs = () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const { logs: newLogs = [], end } = yield getLogChunks(((_a = logs[0]) === null || _a === void 0 ? void 0 : _a.id) || 0, LIMIT, generateToken(LOGS_CANCEL_TOKEN));
            if (end && !lastLog) {
                stopTimeout();
            }
            setLogs(newLogs);
            setLastLog(!!end);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
    });
    useEffect(() => {
        triggerTimeout(refreshCurrentLogs, STREAM_INTERVAL, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement(ClipboardButton, { variant: "secondary", getText: formatLogs, className: styles.copyBtnHolder }, Messages.copyToClipboard),
        React.createElement("pre", null,
            formatLogs(),
            !lastLog && React.createElement("div", { className: styles.loadingHolder }, Messages.loading),
            lastLog && !logs.length && Messages.noLogs)));
};
//# sourceMappingURL=ChunkedLogsViewer.js.map