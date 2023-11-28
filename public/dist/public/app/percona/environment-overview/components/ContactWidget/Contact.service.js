import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/Platform';
export const ContactService = {
    getContact(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { customer_success: { name, email }, new_ticket_url, } = yield api.post(`${BASE_URL}/GetContactInformation`, {}, false, token);
            return { name, email, newTicketUrl: new_ticket_url };
        });
    },
};
//# sourceMappingURL=Contact.service.js.map