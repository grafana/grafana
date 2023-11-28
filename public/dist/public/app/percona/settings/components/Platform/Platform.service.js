import { api } from 'app/percona/shared/helpers/api';
export const PlatformService = {
    connect(body) {
        return api.post('/v1/Platform/Connect', body, true);
    },
    disconnect() {
        return api.post('/v1/Platform/Disconnect', {});
    },
    forceDisconnect() {
        return api.post('/v1/Platform/Disconnect', { force: true }, true);
    },
    getServerInfo() {
        return api.post(`/v1/Platform/ServerInfo`, {}, true);
    },
};
//# sourceMappingURL=Platform.service.js.map