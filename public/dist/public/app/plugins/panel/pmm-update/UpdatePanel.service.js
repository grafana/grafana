import { api } from 'app/percona/shared/helpers/api';
export const getCurrentVersion = (body = { force: false }) => api.post('/v1/Updates/Check', body, true);
export const startUpdate = () => api.post('/v1/Updates/Start', {});
export const getUpdateStatus = (body) => api.post('/v1/Updates/Status', body);
//# sourceMappingURL=UpdatePanel.service.js.map