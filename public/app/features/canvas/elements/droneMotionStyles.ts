import { type GrafanaTheme2 } from '@grafana/data';

export function droneAttitudeTransition(theme: GrafanaTheme2) {
  return {
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'transform 0.4s',
    },
  };
}

export function dronePropellerSpin(theme: GrafanaTheme2, direction: 'normal' | 'reverse', rpm?: number) {
  return {
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: 'spin',
      animationDuration: `${rpm ? 60 / Math.abs(rpm) : 0}s`,
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
      animationDirection: direction,
    },
  };
}
