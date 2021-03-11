import throttle from 'lodash/throttle';

/** @internal */
const throttledLog = throttle((...t: any[]) => {
  console.log(...t);
}, 500);

/** @internal */
export const createLogger = (name: string, enable = true) => (id: string, throttle = false, ...t: any[]) => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || !enable) {
    return;
  }
  const fn = throttle ? throttledLog : console.log;
  fn(`[${name}: ${id}]: `, ...t);
};
