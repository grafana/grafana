import { __awaiter } from "tslib";
import { Severity } from 'app/percona/shared/core';
/**
 * A mock version of CheckService
 */
export const CheckService = {
    runDbChecks() {
        return __awaiter(this, void 0, void 0, function* () {
            return {};
        });
    },
    changeCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            return {};
        });
    },
    getFailedCheckForService() {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                totals: {
                    totalItems: 2,
                    totalPages: 1,
                },
                data: [
                    {
                        summary: 'first failed check',
                        description: 'check 1',
                        severity: Severity.SEVERITY_CRITICAL,
                        labels: { primary: [], secondary: [] },
                        readMoreUrl: 'localhost/check-one',
                        serviceName: 'Service One',
                        checkName: 'Check One',
                        silenced: false,
                        alertId: 'alert_1',
                    },
                    {
                        summary: 'second failed check',
                        description: 'check 2',
                        severity: Severity.SEVERITY_NOTICE,
                        labels: { primary: [], secondary: [] },
                        readMoreUrl: '',
                        serviceName: 'Service One',
                        checkName: 'Check Two',
                        silenced: false,
                        alertId: 'alert_2',
                    },
                ],
            };
        });
    },
    getAllFailedChecks() {
        return __awaiter(this, void 0, void 0, function* () {
            return [
                {
                    serviceName: 'Service One',
                    serviceId: 's1',
                    counts: {
                        emergency: 0,
                        alert: 0,
                        critical: 0,
                        error: 0,
                        warning: 0,
                        notice: 0,
                        info: 0,
                        debug: 0,
                    },
                },
            ];
        });
    },
};
//# sourceMappingURL=Check.service.js.map