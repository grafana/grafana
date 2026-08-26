import { createTheme } from '@grafana/data';

import { droneAttitudeTransition, dronePropellerSpin } from './droneMotionStyles';

const theme = createTheme();
const noPreference = '@media (prefers-reduced-motion: no-preference)';

describe('droneAttitudeTransition', () => {
  it('tweens transform only when the user has no reduced-motion preference', () => {
    expect(droneAttitudeTransition(theme)).toEqual({
      [noPreference]: {
        transition: 'transform 0.4s',
      },
    });
  });
});

describe('dronePropellerSpin', () => {
  it('applies a reverse infinite spin only when the user has no reduced-motion preference', () => {
    expect(dronePropellerSpin(theme, 'reverse', 60)).toEqual({
      [noPreference]: {
        animationName: 'spin',
        animationDuration: '1s',
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDirection: 'reverse',
      },
    });
  });

  it.each([
    { rpm: 120, duration: '0.5s' },
    { rpm: -30, duration: '2s' },
    { rpm: 0, duration: '0s' },
    { rpm: undefined, duration: '0s' },
  ])('sets animationDuration to $duration when rpm is $rpm', ({ rpm, duration }) => {
    expect(dronePropellerSpin(theme, 'normal', rpm)).toEqual({
      [noPreference]: {
        animationName: 'spin',
        animationDuration: duration,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDirection: 'normal',
      },
    });
  });
});
