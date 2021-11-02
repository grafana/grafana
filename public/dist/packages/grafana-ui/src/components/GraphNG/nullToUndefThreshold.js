// mutates all nulls -> undefineds in the fieldValues array for value-less refValues ranges below maxThreshold
// refValues is typically a time array and maxThreshold is the allowable distance between in time
export function nullToUndefThreshold(refValues, fieldValues, maxThreshold) {
    var prevRef;
    var nullIdx;
    for (var i = 0; i < fieldValues.length; i++) {
        var fieldVal = fieldValues[i];
        if (fieldVal == null) {
            if (nullIdx == null && prevRef != null) {
                nullIdx = i;
            }
        }
        else {
            if (nullIdx != null) {
                if (refValues[i] - prevRef < maxThreshold) {
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
//# sourceMappingURL=nullToUndefThreshold.js.map