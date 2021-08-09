export const Messages = {
  serviceName: 'Service name',
  vendor: 'Vendor',
  dataModel: 'Data model',
  databases: 'Databases',
  backupName: 'Backup name',
  description: 'Description',
  location: 'Location',
  retryMode: 'Retry mode',
  editAction: 'Edit',
  backupAction: 'Backup',
  scheduleAction: 'Schedule',
  cancelAction: 'Cancel',
  retryTimes: 'Retry, times',
  retryInterval: 'Retry interval, seconds',
  every: 'Every',
  month: 'Month',
  day: 'Day',
  weekDay: 'Weekday',
  startTime: 'Start time, h/m',
  fullLogs: 'Full logs',
  enabled: 'Enabled',
  retention: 'Retention (Number of backups - 0 for unlimited)',
  scheduleSection: 'Schedule - UTC time',
  getModalTitle: (scheduleMode: boolean, edit: boolean) => {
    if (edit) {
      return scheduleMode ? 'Edit Scheduled backup' : 'Edit Backup on demand';
    }

    return scheduleMode ? 'Schedule backup' : 'Backup on demand';
  },
};
