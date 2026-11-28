import {
  getImportPlan,
  getNextStep,
  getPreviousStep,
  getWizardSteps,
  isAutoSyncCommitted,
  isAutoSyncSelected,
  isLastStep,
} from './steps';
import { StepKey } from './types';

describe('getWizardSteps', () => {
  it('returns the three-step rail', () => {
    const steps = getWizardSteps().map((s) => s.id);
    expect(steps).toEqual([StepKey.Notifications, StepKey.Rules, StepKey.Review]);
  });
});

describe('getNextStep', () => {
  it('advances from Notification configuration to Rules', () => {
    expect(getNextStep(StepKey.Notifications)?.id).toBe(StepKey.Rules);
  });

  it('advances from Rules to Review', () => {
    expect(getNextStep(StepKey.Rules)?.id).toBe(StepKey.Review);
  });

  it('returns undefined past the last step', () => {
    expect(getNextStep(StepKey.Review)).toBeUndefined();
  });
});

describe('getPreviousStep', () => {
  it('goes back from Rules to Notification configuration', () => {
    expect(getPreviousStep(StepKey.Rules)?.id).toBe(StepKey.Notifications);
  });

  it('goes back from Review to Rules', () => {
    expect(getPreviousStep(StepKey.Review)?.id).toBe(StepKey.Rules);
  });

  it('returns undefined before the first step', () => {
    expect(getPreviousStep(StepKey.Notifications)).toBeUndefined();
  });
});

describe('isLastStep', () => {
  it('is true only for the Review step', () => {
    expect(isLastStep(StepKey.Review)).toBe(true);
    expect(isLastStep(StepKey.Notifications)).toBe(false);
  });
});

describe('isAutoSyncSelected', () => {
  it('is true only when Auto-sync is enabled and the source is a data source', () => {
    expect(isAutoSyncSelected(true, 'datasource')).toBe(true);
  });

  it('is false when Auto-sync is disabled', () => {
    expect(isAutoSyncSelected(false, 'datasource')).toBe(false);
  });

  it('is false for the YAML source, even with Auto-sync enabled', () => {
    expect(isAutoSyncSelected(true, 'yaml')).toBe(false);
  });
});

describe('isAutoSyncCommitted', () => {
  it('is true when Auto-sync is selected and Step 1 was completed', () => {
    expect(isAutoSyncCommitted(true, 'datasource', false)).toBe(true);
  });

  it('is false when Step 1 was skipped, even with Auto-sync selected', () => {
    expect(isAutoSyncCommitted(true, 'datasource', true)).toBe(false);
  });

  it('is false when Auto-sync was never selected', () => {
    expect(isAutoSyncCommitted(false, 'datasource', false)).toBe(false);
  });
});

describe('getImportPlan', () => {
  const base = {
    autoSyncNotificationsEnabled: false,
    notificationsSource: 'yaml' as const,
    step1Completed: false,
    step1Skipped: false,
    step2Completed: false,
    step2Skipped: false,
  };

  it('plans nothing before any step is completed', () => {
    expect(getImportPlan(base)).toEqual({
      willEnableAutoSync: false,
      willImportNotifications: false,
      willImportRules: false,
    });
  });

  it('plans a notifications import once step 1 is completed', () => {
    expect(getImportPlan({ ...base, step1Completed: true })).toMatchObject({ willImportNotifications: true });
  });

  it('plans nothing for step 1 when it was skipped, even if it had been completed', () => {
    expect(getImportPlan({ ...base, step1Completed: true, step1Skipped: true })).toMatchObject({
      willImportNotifications: false,
    });
  });

  it('plans a rules import once step 2 is completed and not skipped', () => {
    expect(getImportPlan({ ...base, step2Completed: true })).toMatchObject({ willImportRules: true });
    expect(getImportPlan({ ...base, step2Completed: true, step2Skipped: true })).toMatchObject({
      willImportRules: false,
    });
  });

  it('plans Auto-sync only for the data source source, and not when step 1 was skipped', () => {
    const autoSync = { ...base, autoSyncNotificationsEnabled: true, notificationsSource: 'datasource' as const };
    expect(getImportPlan(autoSync)).toMatchObject({ willEnableAutoSync: true });
    expect(getImportPlan({ ...autoSync, step1Skipped: true })).toMatchObject({ willEnableAutoSync: false });
    expect(getImportPlan({ ...autoSync, notificationsSource: 'yaml' })).toMatchObject({ willEnableAutoSync: false });
  });

  it('treats a missing Auto-sync flag as off', () => {
    expect(getImportPlan({ ...base, autoSyncNotificationsEnabled: undefined })).toMatchObject({
      willEnableAutoSync: false,
    });
  });
});
