import { __awaiter } from "tslib";
import { useState } from 'react';
import { logger } from 'app/percona/shared/helpers/logger';
import { startUpdate } from '../UpdatePanel.service';
export const useInitializeUpdate = () => {
    const [updateFailed, setUpdateFailed] = useState(false);
    const [authToken, setAuthToken] = useState('');
    const [initialLogOffset, setInitialLogOffset] = useState(0);
    const launchUpdate = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const data = yield startUpdate();
            if (!data) {
                throw Error('Invalid response received');
            }
            const { auth_token, log_offset } = data;
            setAuthToken(auth_token);
            setInitialLogOffset(log_offset);
        }
        catch (e) {
            setUpdateFailed(true);
            logger.error(e);
        }
    });
    return [authToken, initialLogOffset, updateFailed, launchUpdate];
};
//# sourceMappingURL=useInitializeUpdate.js.map