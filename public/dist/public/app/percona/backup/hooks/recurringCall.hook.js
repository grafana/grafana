import { __awaiter } from "tslib";
import { useCallback, useEffect, useRef } from 'react';
import { logger } from 'app/percona/shared/helpers/logger';
export const useRecurringCall = () => {
    const timer = useRef();
    const interval = useRef();
    const stopTimeout = useCallback(() => {
        !!timer.current && clearTimeout(timer.current);
    }, []);
    const triggerTimeout = useCallback((cb, defaultInterval = 10000, callImmediate = false) => __awaiter(void 0, void 0, void 0, function* () {
        interval.current = defaultInterval;
        try {
            callImmediate && (yield cb());
            stopTimeout();
            timer.current = setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                yield cb();
                triggerTimeout(cb, interval.current);
            }), interval.current);
        }
        catch (e) {
            logger.error(e);
            triggerTimeout(cb, interval.current);
        }
    }), [stopTimeout]);
    const changeInterval = useCallback((newInterval) => {
        interval.current = newInterval;
    }, []);
    useEffect(() => {
        return stopTimeout;
    }, [stopTimeout]);
    return [triggerTimeout, changeInterval, stopTimeout];
};
//# sourceMappingURL=recurringCall.hook.js.map