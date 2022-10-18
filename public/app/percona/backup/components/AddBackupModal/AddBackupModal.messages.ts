export const Messages = {
  serviceName: 'Service name',
  vendor: 'DB technology',
  dataModel: 'Data model',
  type: 'Backup type',
  databases: 'Databases',
  backupName: 'Backup name',
  description: 'Description',
  location: 'Location',
  retryMode: 'Retry mode',
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
    if (scheduleMode) {
      return edit ? 'Edit Scheduled backup' : 'Schedule backup';
    }

    return 'Backup on demand';
  },
  getSubmitButtonText: (scheduleMode: boolean, edit: boolean) => {
    if (scheduleMode) {
      return edit ? 'Edit' : 'Schedule';
    }

    return 'Backup';
  },
};
