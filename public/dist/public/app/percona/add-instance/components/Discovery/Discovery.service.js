import { __awaiter } from "tslib";
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { apiManagement } from 'app/percona/shared/helpers/api';
import { Messages } from './Discovery.messages';
const { awsNoCredentialsError, noCredentialsError } = Messages;
class DiscoveryService {
    static discoveryRDS({ aws_access_key, aws_secret_key }, token, disableNotifications = false) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement
                .post('/RDS/Discover', {
                aws_access_key,
                aws_secret_key,
            }, true, token)
                .catch((e) => {
                var _a, _b;
                if (!disableNotifications) {
                    const originalMessage = (_b = (_a = e.response.data) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : 'Unknown error';
                    const message = originalMessage.includes(awsNoCredentialsError) ? noCredentialsError : originalMessage;
                    appEvents.emit(AppEvents.alertError, [message]);
                }
            });
        });
    }
}
export default DiscoveryService;
//# sourceMappingURL=Discovery.service.js.map