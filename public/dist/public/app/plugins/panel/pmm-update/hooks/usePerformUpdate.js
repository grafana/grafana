import { __awaiter } from "tslib";
import { useEffect, useState } from 'react';
import { getUpdateStatus } from '../UpdatePanel.service';
import { useInitializeUpdate } from './useInitializeUpdate';
export const usePerformUpdate = () => {
    const [updateFailed, setUpdateFailed] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [output, setOutput] = useState('');
    const [updateFinished, setUpdateFinished] = useState(false);
    const [timeoutId, setTimeoutId] = useState();
    const [authToken, initialLogOffset, initializationFailed, launchUpdate] = useInitializeUpdate();
    useEffect(() => {
        if (!authToken || initialLogOffset === undefined) {
            return;
        }
        const updateStatus = (logOffset, errorsCount = 0) => __awaiter(void 0, void 0, void 0, function* () {
            // Set the errorCount high enough to make it possible for the user to find the error
            if (errorsCount > 600 || initializationFailed) {
                setUpdateFailed(true);
                return;
            }
            let newErrorsCount = errorsCount;
            let newLogOffset = logOffset;
            let newIsUpdated = false;
            try {
                const response = yield getUpdateStatus({ auth_token: authToken, log_offset: logOffset });
                if (!response) {
                    throw Error('Invalid response received');
                }
                const { done, log_offset, log_lines } = response;
                setOutput((previousOutput) => {
                    const logLines = log_lines !== null && log_lines !== void 0 ? log_lines : [];
                    return `${previousOutput}${logLines.join('\n')}\n`;
                });
                newLogOffset = log_offset !== null && log_offset !== void 0 ? log_offset : 0;
                newErrorsCount = 0;
                newIsUpdated = done !== null && done !== void 0 ? done : false;
            }
            catch (e) {
                newErrorsCount += 1;
                //@ts-ignore
                setErrorMessage(e.message);
            }
            finally {
                if (newIsUpdated) {
                    setUpdateFinished(newIsUpdated);
                }
                else {
                    const timeout = setTimeout(updateStatus, 500, newLogOffset, newErrorsCount);
                    setTimeoutId(timeout);
                }
            }
        });
        updateStatus(initialLogOffset, 0);
        // eslint-disable-next-line consistent-return
        return () => {
            // @ts-ignore
            clearTimeout(timeoutId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authToken, initialLogOffset]);
    useEffect(() => {
        setUpdateFailed(initializationFailed);
    }, [initializationFailed]);
    return [output, errorMessage, updateFinished, updateFailed, launchUpdate];
};
//# sourceMappingURL=usePerformUpdate.js.map