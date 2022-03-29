import { HIDDEN_LABELS, PRIMARY_LABELS, PrioritizedLabels } from '../core';

export const formatLabel = (label: [string, string]): string => {
  const [key, value] = label;

  return `${key}=${value}`;
};

export const formatLabels = (labels: { [key: string]: string }): PrioritizedLabels => {
  const alertLabels: PrioritizedLabels = {
    primary: [],
    secondary: [],
  };

  Object.entries(labels).forEach(([key, value]) => {
    const formattedLabel = formatLabel([key, value]);

    if (PRIMARY_LABELS.includes(key)) {
      alertLabels.primary.push(formattedLabel);
    } else if (!HIDDEN_LABELS.includes(key)) {
      alertLabels.secondary.push(formattedLabel);
    }
  });

  return alertLabels;
};
