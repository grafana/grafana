import {
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
  it('advances from Notification resources to Alert rules', () => {
    expect(getNextStep(StepKey.Notifications)?.id).toBe(StepKey.Rules);
  });

  it('advances from Alert rules to Review', () => {
    expect(getNextStep(StepKey.Rules)?.id).toBe(StepKey.Review);
  });

  it('returns undefined past the last step', () => {
    expect(getNextStep(StepKey.Review)).toBeUndefined();
  });
});

describe('getPreviousStep', () => {
  it('goes back from Alert rules to Notification resources', () => {
    expect(getPreviousStep(StepKey.Rules)?.id).toBe(StepKey.Notifications);
  });

  it('goes back from Review to Alert rules', () => {
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
