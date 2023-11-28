import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';
export const Messages = {
    [ServiceStatus.UP]: 'Database is running.',
    [ServiceStatus.DOWN]: 'Database is not running.',
    [ServiceStatus.UNKNOWN]: 'Indicates agent unavailability or incorrect database status. Troubleshoot the configuration.',
    [ServiceStatus.NA]: 'Arises when external services are monitored and required metrics cannot be checked to determine service availability.',
};
//# sourceMappingURL=StatusInfo.messages.js.map