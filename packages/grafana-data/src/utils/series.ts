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
