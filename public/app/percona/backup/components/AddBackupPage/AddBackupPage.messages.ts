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
  in: 'in',
  on: 'on',
  at: 'at',
  every: 'Every',
  everyMonth: 'Every month',
  everyDay: 'Every day',
  everyWeekDay: 'Every weekday',
  everyHour: 'Every hour',
  everyMinute: 'Every minute',
  minute: 'Minutes',
  hour: 'Hours',
  month: 'Months',
  day: 'Days',
  weekDay: 'Weekdays',
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
  scheduledTime: 'Scheduled time',
  scheduleName: 'Schedule',
  getModalTitle: (scheduleMode: boolean, edit: boolean) => {
    if (scheduleMode) {
      return edit ? 'Edit Scheduled backup' : 'Create Scheduled backup';
    }

    return 'Create Backup on demand';
  },
  getSubmitButtonText: (scheduleMode: boolean, edit: boolean) => {
    if (scheduleMode) {
      return edit ? 'Edit' : 'Schedule';
    }

    return 'Backup';
  },
};
