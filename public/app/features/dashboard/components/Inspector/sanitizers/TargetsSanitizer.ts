import { CollectorData, CollectorItem, CollectorWorkers, Sanitizer } from '../types';
import { copyAndSanitize, SanitizeContext } from './utils';

export class TargetsSanitizer implements Sanitizer {
  private context: SanitizeContext;

  constructor(readonly id: string, replaceWith = '******') {
    this.context = { replaceWith, shouldReplace };
  }

  canSanitize(item: CollectorItem): boolean {
    switch (item.id) {
      case CollectorWorkers.panelJson:
      case CollectorWorkers.panelData:
      case CollectorWorkers.dashboard:
        return true;

      default:
        return false;
    }
  }

  sanitize(item: CollectorItem): CollectorData {
    switch (item.id) {
      case CollectorWorkers.panelJson:
        return sanitizePanelJson(item.data, this.context);
      case CollectorWorkers.panelData:
        return sanitizePanelData(item.data, this.context);
      case CollectorWorkers.dashboard:
        return sanitizeDashboard(item.data, this.context);

      default:
        return item.data;
    }
  }
}

const sanitizePanelJson = (data: CollectorData, context: SanitizeContext): CollectorData => {
  const targets = data.targets;

  if (!Array.isArray(targets)) {
    return data;
  }

  return {
    ...data,
    targets: targets.map((t) => copyAndSanitize(t, context)),
  };
};

const sanitizePanelData = (data: CollectorData, context: SanitizeContext): CollectorData => {
  const targets = data.request?.targets;

  if (!Array.isArray(targets)) {
    return data;
  }

  return {
    ...data,
    request: {
      ...data.request,
      targets: targets.map((t) => copyAndSanitize(t, context)),
    },
  };
};

const sanitizeDashboard = (data: CollectorData, context: SanitizeContext): CollectorData => {
  const panels = data.panels;

  if (!Array.isArray(panels)) {
    return data;
  }

  return panels.map((panel) => {
    const targets = panel?.targets;

    if (!Array.isArray(targets)) {
      return panel;
    }

    return {
      ...panel,
      targets: targets.map((t) => copyAndSanitize(t, context)),
    };
  });
};

const shouldReplace = (key: string, value: any): boolean => {
  if (keepValuesWithKey(key)) {
    return false;
  }
  return typeof value === 'string';
};

const keepValuesWithKey = (key: string): boolean => {
  switch (key) {
    case 'refId':
    case 'key':
    case 'queryType':
    case 'dataTopic':
      return true;

    default:
      return false;
  }
};
