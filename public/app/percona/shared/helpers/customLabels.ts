const fromPayload = (customLabels: Record<string, string>): string =>
  Object.entries(customLabels)
    .map(([label, value]) => label + ':' + value)
    .join('\n');

const toPayload = (customLabels: string): Record<string, string> =>
  customLabels
    .split(/[\n\s]/)
    .filter(Boolean)
    .reduce((acc: Record<string, string>, val: string) => {
      const [key, value] = val.split(':');

      acc[key] = value;

      return acc;
    }, {});

export const CustomLabelsUtils = {
  fromPayload,
  toPayload,
};
