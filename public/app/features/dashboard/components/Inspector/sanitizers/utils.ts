export interface SanitizeContext {
  replaceWith: string;
  shouldReplace: (key: string | undefined, value: any) => boolean;
}

export const copyAndSanitize = (value: any, context: SanitizeContext): any => sanitize('', value, context);

const sanitize = (valueKey: string, value: any, context: SanitizeContext): any => {
  const { replaceWith, shouldReplace } = context;

  if (Array.isArray(value)) {
    return value.map((v) => sanitize(valueKey, v, context));
  }

  if (typeof value === 'object') {
    const destination: Record<string, any> = {};

    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        continue;
      }
      destination[key] = sanitize(key, value[key], context);
    }

    return destination;
  }

  if (shouldReplace(valueKey, value)) {
    return replaceWith;
  }

  return value;
};
