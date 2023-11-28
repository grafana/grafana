import { GoogleAuthType } from '@grafana/google-sdk';
export const createMockInstanceSetttings = (overrides) => (Object.assign({ url: '/ds/1', id: 1, uid: 'abc', type: 'stackdriver', access: 'proxy', meta: {}, name: 'stackdriver', readOnly: false, jsonData: {
        authenticationType: GoogleAuthType.JWT,
        defaultProject: 'test-project',
        gceDefaultProject: 'test-project',
        clientEmail: 'test-email@test.com',
        tokenUri: 'https://oauth2.googleapis.com/token',
    } }, overrides));
//# sourceMappingURL=cloudMonitoringInstanceSettings.js.map