/**
 * Ensures the context is a flat object with strings (required by Faro)
 */
export function prepareContext(context: Object): Record<string, string> {
  const preparedContext = {};
  function prepare(value, propertyName) {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        throw new Error('Array values are not supported.');
      } else {
        for (const key in value) {
          if (value.hasOwnProperty(key)) {
            prepare(value[key], propertyName ? `${propertyName}_${key}` : key);
          }
        }
      }
    } else if (typeof value === 'string') {
      preparedContext[propertyName] = value;
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        preparedContext[propertyName] = value.toString();
      } else {
        preparedContext[propertyName] = value.toFixed(4);
      }
    }
  }
  prepare(context, 'context');
  return preparedContext;
}
