/** @alpha */
export interface CreateTransitionOptions {
  duration?: number | string;
  easing?: string;
  delay?: number | string;
}

interface Duration {
  shortest: number;
  shorter: number;
  short: number;
  standard: number;
  complex: number;
  enteringScreen: number;
  leavingScreen: number;
}

interface Easing {
  easeInOut: string;
  easeOut: string;
  easeIn: string;
  sharp: string;
}

export type ReducedMotionProps = 'no-preference' | 'reduce';

/** @alpha */
export interface ThemeTransitions {
  create: (props?: string | string[], options?: CreateTransitionOptions) => string;
  duration: Duration;
  easing: Easing;
  getAutoHeightDuration: (height: number) => number;
  handleMotion: (...props: ReducedMotionProps[]) => string;
}
