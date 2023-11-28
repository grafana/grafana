import { Databases } from 'app/percona/shared/core';
import { BackupMode } from '../../Backup.types';
export const Messages = {
    serviceName: 'Service name',
    vendor: 'DB technology',
    dataModel: 'Data model',
    type: 'Backup type',
    databases: 'Databases',
    backupName: 'Backup name',
    description: 'Description',
    folder: 'Folder',
    location: 'Location',
    retryMode: 'Retry mode',
    cancelAction: 'Cancel',
    retryTimes: 'Retry, times',
    retryInterval: 'Retry interval, seconds',
    every: 'Every',
    startTimeHour: 'Start time (hour)',
    startTimeMinute: 'Start time (minute)',
    advanceSettings: 'Advanced Settings:',
    fullLogs: 'Full logs',
    enabled: 'Enabled',
    retention: 'Retention (Number of backups - 0 for unlimited)',
    scheduleSection: 'UTC time',
    backupInfo: 'Backup info',
    onDemand: 'On Demand',
    schedule: 'Schedule Backup',
    scheduleName: 'Schedule',
    getModalTitle: (scheduleMode, edit) => {
        if (scheduleMode) {
            return edit ? 'Edit Scheduled backup' : 'Create Scheduled backup';
        }
        return 'Create Backup on demand';
    },
    getSubmitButtonText: (scheduleMode, edit) => {
        if (scheduleMode) {
            return edit ? 'Edit' : 'Schedule';
        }
        return 'Backup';
    },
    backupDescription: 'Create a backup of a database immediately, to store a snapshot of its current state and data.',
    scheduleBackupDescription: 'Create a task that takes regular backups of a database, according to the schedule that you specify.',
    folderTooltip: 'Changing the default folder, if available, is not recommended',
    folderTooltipLink: (vendor, mode) => {
        if (vendor === Databases.mysql) {
            return 'https://per.co.na/mysql_folder_field';
        }
        if (vendor === Databases.mongodb) {
            return mode === BackupMode.PITR
                ? 'https://per.co.na/mongo_pitr_folder_field'
                : 'https://per.co.na/mongo_folder_field';
        }
        return;
    },
};
//# sourceMappingURL=AddBackupPage.messages.js.map