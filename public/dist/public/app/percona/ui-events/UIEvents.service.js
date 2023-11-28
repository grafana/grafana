/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-assertions, */
import { __awaiter } from "tslib";
import { ApiRequest } from 'app/percona/shared/helpers/api';
const api = new ApiRequest({ baseURL: '/v1/ui-events' });
export const UIEventsService = {
    store(body) {
        return __awaiter(this, void 0, void 0, function* () {
            yield api.post('/Store', body, true);
        });
    },
};
//# sourceMappingURL=UIEvents.service.js.map