// mutates all nulls -> undefineds in the fieldValues array for value-less refValues ranges below maxThreshold
// refValues is typically a time array and maxThreshold is the allowable distance between in time
export function nullToUndefThreshold(refValues: number[], fieldValues: any[], maxThreshold: number): any[] {
  let prevRef;
  let nullIdx;

  for (let i = 0; i < fieldValues.length; i++) {
    let fieldVal = fieldValues[i];

    if (fieldVal == null) {
      if (nullIdx == null && prevRef != null) {
        nullIdx = i;
      }
    } else {
      if (nullIdx != null) {
        if (refValues[i] - (prevRef as number) < maxThreshold) {
          while (nullIdx < i) {
            fieldValues[nullIdx++] = undefined;
          }
        }

        nullIdx = null;
      }

      prevRef = refValues[i];
    }
  }

  return fieldValues;
}
