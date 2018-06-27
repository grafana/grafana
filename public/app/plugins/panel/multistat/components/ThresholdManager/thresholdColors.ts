export const CRITICAL_LINE_COLOR = 'rgba(237, 46, 24, 0.60)';
export const CRITICAL_FILL_COLOR = 'rgba(234, 112, 112, 0.12)';
export const WARNING_LINE_COLOR = 'rgba(247, 149, 32, 0.60)';
export const WARNING_FILL_COLOR = 'rgba(235, 138, 14, 0.12)';
export const OK_LINE_COLOR = 'rgba(6,163,69, 0.60)';
export const OK_FILL_COLOR = 'rgba(11, 237, 50, 0.090)';
export const CRITICAL_COLOR = CRITICAL_LINE_COLOR;
export const WARNING_COLOR = WARNING_LINE_COLOR;
export const OK_COLOR = OK_LINE_COLOR;

export function getColor(colorMode) {
  switch (colorMode) {
    case 'critical': {
      return CRITICAL_COLOR;
    }
    case 'warning': {
      return WARNING_COLOR;
    }
    case 'ok': {
      return OK_COLOR;
    }
    default: {
      return undefined;
    }
  }
}

export default {
  CRITICAL_COLOR,
  CRITICAL_LINE_COLOR,
  CRITICAL_FILL_COLOR,
  WARNING_COLOR,
  WARNING_LINE_COLOR,
  WARNING_FILL_COLOR,
  OK_COLOR,
  OK_LINE_COLOR,
  OK_FILL_COLOR,
  getColor,
};
