// eslint-disable-next-line no-shadow
export enum LOG_LEVELS {
  // this will log everything
  DEBUG = 0,
  LOG = 1,
  INFO = 2,
  WARN = 3,
  // this will only log errors
  ERROR = 4,
  // this will silence the logger (mainly used in tests)
  NONE = 5,
}
