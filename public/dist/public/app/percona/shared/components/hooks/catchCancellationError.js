import { __awaiter } from "tslib";
import { logger } from 'app/percona/shared/helpers/logger';
import { PERCONA_CANCELLED_ERROR_NAME } from '../../core/constants';
import { isApiCancelError } from '../../helpers/api';
// Used to safely return from a side effect that might trigger when the component unmounted
// and some promise resolved in the meanwhile
export const useCatchCancellationError = () => {
    const catchFromAsyncThunkAction = (p) => __awaiter(void 0, void 0, void 0, function* () {
        const data = yield p;
        const { error } = data;
        if (error) {
            if (error.name === PERCONA_CANCELLED_ERROR_NAME) {
                return;
            }
            else {
                logger.error(error);
            }
        }
        return data;
    });
    const catchFromApiPromise = (p) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const data = yield p;
            return data;
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
    });
    return [catchFromAsyncThunkAction, catchFromApiPromise];
};
//# sourceMappingURL=catchCancellationError.js.map