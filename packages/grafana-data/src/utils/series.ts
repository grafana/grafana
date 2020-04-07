import { Field } from '../types/dataFrame';

/**
 * Returns minimal time step from series time field
 * @param timeField
 */
export const getSeriesTimeStep = (timeField: Field) => {
  let previousTime;
  let minTimeStep;

  for (let i = 0; i < timeField.values.length; i++) {
    const currentTime = timeField.values.get(i);

    if (previousTime !== undefined) {
      const timeStep = currentTime - previousTime;

      if (minTimeStep === undefined) {
        minTimeStep = timeStep;
      }

      if (timeStep < minTimeStep) {
        minTimeStep = timeStep;
      }
    }
    previousTime = currentTime;
  }
  return minTimeStep;
};

/**
 * Checks if series time field has ms resolution
 * @param timeField
 */
export const hasMsResolution = (timeField: Field) => {
  for (let i = 0; i < timeField.values.length; i++) {
    const value = timeField.values.get(i);
    if (value !== null && value !== undefined) {
      const timestamp = value.toString();
      if (timestamp.length === 13 && timestamp % 1000 !== 0) {
        return true;
      }
    }
  }
  return false;
};
