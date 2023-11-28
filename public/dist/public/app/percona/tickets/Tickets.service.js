import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/Platform';
export const TicketsService = {
    list(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { tickets = [] } = yield api.post(`${BASE_URL}/SearchOrganizationTickets`, {}, false, token);
            return tickets.map(({ number, short_description, priority, state, create_time, department, task_type, url }) => ({
                number,
                shortDescription: short_description,
                priority,
                state,
                createTime: new Date(create_time).toLocaleDateString('en-GB'),
                department,
                taskType: task_type,
                url,
            }));
        });
    },
};
//# sourceMappingURL=Tickets.service.js.map