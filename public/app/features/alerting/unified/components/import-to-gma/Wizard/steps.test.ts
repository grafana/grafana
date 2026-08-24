import { getNextStep, getPreviousStep, getWizardSteps, isLastStep, isRulesForcedSkipped } from './steps';
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

  it('returns undefined past the last step', () => {
    expect(getNextStep(StepKey.Review)).toBeUndefined();
  });

  it('jumps from Notification resources straight to Review when Rules is force-skipped', () => {
    expect(getNextStep(StepKey.Notifications, true)?.id).toBe(StepKey.Review);
  });

  it('does not skip Rules when skipRules is false', () => {
    expect(getNextStep(StepKey.Notifications, false)?.id).toBe(StepKey.Rules);
  });
});

describe('getPreviousStep', () => {
  it('goes back from Alert rules to Notification resources', () => {
    expect(getPreviousStep(StepKey.Rules)?.id).toBe(StepKey.Notifications);
  });

  it('returns undefined before the first step', () => {
    expect(getPreviousStep(StepKey.Notifications)).toBeUndefined();
  });

  it('jumps from Review straight back to Notification resources when Rules is force-skipped', () => {
    expect(getPreviousStep(StepKey.Review, true)?.id).toBe(StepKey.Notifications);
  });

  it('does not skip Rules when skipRules is false', () => {
    expect(getPreviousStep(StepKey.Review, false)?.id).toBe(StepKey.Rules);
  });
});

describe('isLastStep', () => {
  it('is true only for the Review step', () => {
    expect(isLastStep(StepKey.Review)).toBe(true);
    expect(isLastStep(StepKey.Notifications)).toBe(false);
  });
});

describe('isRulesForcedSkipped', () => {
  it('is true only when Auto-sync is enabled and the source is a data source', () => {
    expect(isRulesForcedSkipped(true, 'datasource')).toBe(true);
  });

  it('is false when Auto-sync is disabled', () => {
    expect(isRulesForcedSkipped(false, 'datasource')).toBe(false);
  });

  it('is false for the YAML source, even with Auto-sync enabled', () => {
    expect(isRulesForcedSkipped(true, 'yaml')).toBe(false);
  });
});
