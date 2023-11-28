import { rest } from 'msw';
import { AlertmanagerChoice, } from '../../../../plugins/datasource/alertmanager/types';
import { getDatasourceAPIUid } from '../utils/datasource';
export const defaultAlertmanagerChoiceResponse = {
    alertmanagersChoice: AlertmanagerChoice.Internal,
    numExternalAlertmanagers: 0,
};
export function mockAlertmanagerChoiceResponse(server, response) {
    server.use(rest.get('/api/v1/ngalert', (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}
export const emptyExternalAlertmanagersResponse = {
    data: {
        droppedAlertManagers: [],
        activeAlertManagers: [],
    },
};
export function mockAlertmanagersResponse(server, response) {
    server.use(rest.get('/api/v1/ngalert/alertmanagers', (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}
export function mockAlertmanagerConfigResponse(server, alertManagerSourceName, response) {
    server.use(rest.get(`/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}
//# sourceMappingURL=alertmanagerApi.js.map