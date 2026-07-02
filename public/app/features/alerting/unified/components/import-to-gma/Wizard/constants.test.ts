import { getNextStep, getPreviousStep, getWizardSteps, isAutoSyncMethod, isFirstStep, isLastStep } from './constants';
import { StepKey } from './types';

describe('getWizardSteps', () => {
  it.each(['stage', 'promote'] as const)('returns the full four-step rail for the %s import method', (method) => {
    const steps = getWizardSteps(method).map((s) => s.id);
    expect(steps).toEqual([StepKey.Method, StepKey.Notifications, StepKey.Rules, StepKey.Review]);
  });

  it('collapses to a two-step rail for the autosync method', () => {
    const steps = getWizardSteps('autosync').map((s) => s.id);
    expect(steps).toEqual([StepKey.Method, StepKey.ReviewEnable]);
  });
});

describe('getNextStep', () => {
  it('advances from Method into Notification resources for an import method', () => {
    expect(getNextStep(StepKey.Method, 'promote')?.id).toBe(StepKey.Notifications);
  });

  it('advances from Method straight to Review & enable for autosync', () => {
    expect(getNextStep(StepKey.Method, 'autosync')?.id).toBe(StepKey.ReviewEnable);
  });

  it('returns undefined past the last step of each method', () => {
    expect(getNextStep(StepKey.Review, 'stage')).toBeUndefined();
    expect(getNextStep(StepKey.ReviewEnable, 'autosync')).toBeUndefined();
  });
});

describe('getPreviousStep', () => {
  it('goes back from Notification resources to Method for an import method', () => {
    expect(getPreviousStep(StepKey.Notifications, 'stage')?.id).toBe(StepKey.Method);
  });

  it('goes back from Review & enable to Method for autosync', () => {
    expect(getPreviousStep(StepKey.ReviewEnable, 'autosync')?.id).toBe(StepKey.Method);
  });

  it('returns undefined before the first step', () => {
    expect(getPreviousStep(StepKey.Method, 'promote')).toBeUndefined();
  });
});

describe('isFirstStep', () => {
  it('is true only for the Method step', () => {
    expect(isFirstStep(StepKey.Method)).toBe(true);
    expect(isFirstStep(StepKey.Notifications)).toBe(false);
  });
});

describe('isLastStep', () => {
  it('is the Review step for import methods', () => {
    expect(isLastStep(StepKey.Review, 'stage')).toBe(true);
    expect(isLastStep(StepKey.Notifications, 'stage')).toBe(false);
  });

  it('is the Review & enable step for autosync', () => {
    expect(isLastStep(StepKey.ReviewEnable, 'autosync')).toBe(true);
    expect(isLastStep(StepKey.Method, 'autosync')).toBe(false);
  });
});

describe('isAutoSyncMethod', () => {
  it('is true only for the autosync method', () => {
    expect(isAutoSyncMethod('autosync')).toBe(true);
    expect(isAutoSyncMethod('stage')).toBe(false);
    expect(isAutoSyncMethod('promote')).toBe(false);
  });
});
