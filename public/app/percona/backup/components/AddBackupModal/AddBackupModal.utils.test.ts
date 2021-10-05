import { stubs as backupStubs } from '../BackupInventory/__mocks__/BackupInventory.service';
import { BackupMode, DataModel, RetryMode } from 'app/percona/backup/Backup.types';
import { ScheduledBackup } from '../ScheduledBackups/ScheduledBackups.types';
import { AddBackupFormProps } from './AddBackupModal.types';
import {
  toFormBackup,
  isCronFieldDisabled,
  getOptionFromPeriodType,
  getOptionFromDigit,
  getBackupModeOptions,
  getDataModelFromVendor,
} from './AddBackupModal.utils';
import { Databases } from 'app/percona/shared/core';

describe('AddBackupModal::utils', () => {
  describe('toFormBackup', () => {
    it('should return default values if a null Backup is passed', () => {
      expect(toFormBackup(null)).toEqual<AddBackupFormProps>({
        id: '',
        service: null,
        dataModel: DataModel.PHYSICAL,
        backupName: '',
        description: '',
        location: null,
        retryMode: RetryMode.MANUAL,
        retryTimes: 2,
        retryInterval: 30,
        period: { value: 'year', label: 'Year' },
        month: [],
        day: [],
        weekDay: [],
        startHour: [{ value: 0, label: '00' }],
        startMinute: [{ value: 0, label: '00' }],
        retention: 7,
        logs: false,
        active: true,
        vendor: null,
        mode: BackupMode.SNAPSHOT,
      });
    });

    it('should convert to form props', () => {
      const backup = backupStubs[0];
      const { id, serviceName, serviceId, vendor, dataModel, locationName, locationId } = backup;

      expect(toFormBackup(backup)).toEqual<AddBackupFormProps>({
        id,
        service: { label: serviceName, value: { id: serviceId, vendor } },
        dataModel,
        backupName: 'Backup 1',
        description: '',
        location: { label: locationName, value: locationId },
        vendor: Databases.mysql,
        mode: BackupMode.SNAPSHOT,
        retryInterval: 30,
        retryMode: RetryMode.MANUAL,
        retryTimes: 2,
      });
    });

    it('should correctly convert a scheduled backup', () => {
      const backup: ScheduledBackup = {
        id: 'backup_1',
        name: 'Backup 1',
        locationId: 'location_1',
        locationName: 'Location 1',
        serviceId: 'service_1',
        serviceName: 'Service 1',
        vendor: Databases.mongodb,
        start: 1623584353170,
        retention: 0,
        cronExpression: '30 0 * * *',
        lastBackup: 1623584353170,
        dataModel: DataModel.PHYSICAL,
        description: '',
        mode: BackupMode.SNAPSHOT,
        retryInterval: '10s',
        retryTimes: 1,
        enabled: true,
      };

      expect(toFormBackup(backup)).toEqual<AddBackupFormProps>({
        id: backup.id,
        service: { label: 'Service 1', value: { id: 'service_1', vendor: Databases.mongodb } },
        dataModel: DataModel.PHYSICAL,
        backupName: 'Backup 1',
        description: '',
        location: { label: 'Location 1', value: 'location_1' },
        retryMode: RetryMode.AUTO,
        retryTimes: 1,
        retryInterval: 10,
        period: { value: 'day', label: 'Day' },
        month: [],
        day: [],
        weekDay: [],
        startHour: [{ value: 0, label: '00' }],
        startMinute: [{ value: 30, label: '30' }],
        retention: 0,
        logs: false,
        active: true,
        vendor: Databases.mongodb,
        mode: BackupMode.SNAPSHOT,
      });
    });
  });

  describe('isCronFieldDisabled', () => {
    it('should not disabled any fiels for period = year', () => {
      expect(isCronFieldDisabled('year', 'month')).toBeFalsy();
      expect(isCronFieldDisabled('year', 'day')).toBeFalsy();
      expect(isCronFieldDisabled('year', 'weekDay')).toBeFalsy();
      expect(isCronFieldDisabled('year', 'startHour')).toBeFalsy();
      expect(isCronFieldDisabled('year', 'startMinute')).toBeFalsy();
    });

    it('should disable month for period = month', () => {
      expect(isCronFieldDisabled('month', 'month')).toBeTruthy();
      expect(isCronFieldDisabled('month', 'day')).toBeFalsy();
      expect(isCronFieldDisabled('month', 'weekDay')).toBeFalsy();
      expect(isCronFieldDisabled('month', 'startHour')).toBeFalsy();
      expect(isCronFieldDisabled('month', 'startMinute')).toBeFalsy();
    });

    it('should disable month, day for period = week', () => {
      expect(isCronFieldDisabled('week', 'month')).toBeTruthy();
      expect(isCronFieldDisabled('week', 'day')).toBeTruthy();
      expect(isCronFieldDisabled('week', 'weekDay')).toBeFalsy();
      expect(isCronFieldDisabled('week', 'startHour')).toBeFalsy();
      expect(isCronFieldDisabled('week', 'startMinute')).toBeFalsy();
    });

    it('should disable month, day, weekDay for period = day', () => {
      expect(isCronFieldDisabled('day', 'month')).toBeTruthy();
      expect(isCronFieldDisabled('day', 'day')).toBeTruthy();
      expect(isCronFieldDisabled('day', 'weekDay')).toBeTruthy();
      expect(isCronFieldDisabled('day', 'startHour')).toBeFalsy();
      expect(isCronFieldDisabled('day', 'startMinute')).toBeFalsy();
    });

    it('should disable month, day, weekDay, minute for period = hour', () => {
      expect(isCronFieldDisabled('hour', 'month')).toBeTruthy();
      expect(isCronFieldDisabled('hour', 'day')).toBeTruthy();
      expect(isCronFieldDisabled('hour', 'weekDay')).toBeTruthy();
      expect(isCronFieldDisabled('hour', 'startHour')).toBeTruthy();
      expect(isCronFieldDisabled('hour', 'startMinute')).toBeFalsy();
    });
  });

  describe('getOptionFromPeriodType', () => {
    it('should get the right option for a period type', () => {
      expect(getOptionFromPeriodType('year')).toEqual({ value: 'year', label: 'Year' });
      expect(getOptionFromPeriodType('month')).toEqual({ value: 'month', label: 'Month' });
      expect(getOptionFromPeriodType('week')).toEqual({ value: 'week', label: 'Week' });
      expect(getOptionFromPeriodType('day')).toEqual({ value: 'day', label: 'Day' });
      expect(getOptionFromPeriodType('hour')).toEqual({ value: 'hour', label: 'Hour' });
    });
  });

  describe('getOptionFromDigit', () => {
    it('should return an option with the correct number of digits', () => {
      expect(getOptionFromDigit(0)).toEqual({ value: 0, label: '00' });
      expect(getOptionFromDigit(5)).toEqual({ value: 5, label: '05' });
      expect(getOptionFromDigit(8)).toEqual({ value: 8, label: '08' });
      expect(getOptionFromDigit(10)).toEqual({ value: 10, label: '10' });
      expect(getOptionFromDigit(54)).toEqual({ value: 54, label: '54' });
    });
  });

  describe('getBackupModeOptions', () => {
    it('should return backup mode options according to vendor', () => {
      const mongoOptions = getBackupModeOptions(Databases.mongodb);
      const mySqlOptions = getBackupModeOptions(Databases.mysql);
      expect(mongoOptions).toHaveLength(2);
      expect(mySqlOptions).toHaveLength(2);
      expect(mongoOptions[0].value).toBe(BackupMode.PITR);
      expect(mongoOptions[1].value).toBe(BackupMode.SNAPSHOT);
      expect(mySqlOptions[0].value).toBe(BackupMode.INCREMENTAL);
      expect(mySqlOptions[1].value).toBe(BackupMode.SNAPSHOT);
    });
  });

  describe('getDataModelFromVendor', () => {
    it('should return data model according to vendor', () => {
      expect(getDataModelFromVendor(Databases.mongodb)).toBe(DataModel.LOGICAL);
      expect(getDataModelFromVendor(Databases.mysql)).toBe(DataModel.PHYSICAL);
    });
  });
});
