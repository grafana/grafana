import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
export const CommunicationService = {
    testEmailSettings(settings, email) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post('/v1/Settings/TestEmailAlertingSettings', Object.assign(Object.assign({}, settings), { email_to: email }));
        });
    },
};
//# sourceMappingURL=Communication.service.js.map