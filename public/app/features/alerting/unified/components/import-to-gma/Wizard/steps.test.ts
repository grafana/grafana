import { getNextStep, getPreviousStep, getWizardSteps, isLastStep } from './steps';
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
});

describe('getPreviousStep', () => {
  it('goes back from Alert rules to Notification resources', () => {
    expect(getPreviousStep(StepKey.Rules)?.id).toBe(StepKey.Notifications);
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
