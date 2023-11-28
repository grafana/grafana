import { Databases } from 'app/percona/shared/core';
export const serviceStubs = [
    {
        label: 'service_1',
        value: { id: 'Service 1', vendor: Databases.mongodb },
    },
    {
        label: 'service_2',
        value: { id: 'Service 2', vendor: Databases.mysql },
    },
];
export const AddBackupPageService = jest.genMockFromModule('../AddBackupPage.service').AddBackupPageService;
AddBackupPageService.loadServiceOptions = () => Promise.resolve(serviceStubs);
//# sourceMappingURL=AddBackupPage.service.js.map