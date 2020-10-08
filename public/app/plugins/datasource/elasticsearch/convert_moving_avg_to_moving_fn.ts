import { isObject, isNumber } from 'lodash';

interface MovingFnSettings {
  alpha?: number;
  beta?: number;
  gamma?: number;
  period?: number;
}

type ModelType = 'ewma' | 'holt' | 'simple' | 'holt_winters' | 'linear';

export interface MovingAvgMetric {
  type: 'moving_avg';
  pipelineAgg: string | undefined;
  settings: {
    model: ModelType;
    settings?: MovingFnSettings;
    window: number;
    predict: boolean;
    minimize: boolean;
  };
}

const MODELS = ['simple', 'ewma', 'holt', 'holt_winters', 'linear'];

export const isMovingAvgMetric = (subject: any): subject is MovingAvgMetric => {
  return (
    subject.type === 'moving_avg' &&
    isObject(subject.settings) &&
    MODELS.includes(subject.settings.model) &&
    isNumber(subject.settings.window)
  );
};

const scriptFunctions = {
  simple: () => 'MovingFunctions.unweightedAvg(values)',
  ewma: ({ alpha }: MovingFnSettings) => `MovingFunctions.ewma(values, ${alpha || 0.3})`,
  holt: ({ alpha, beta }: MovingFnSettings) => `MovingFunctions.holt(values, ${alpha || 0.3}, ${beta || 0.1})`,
  holtWinters: ({ alpha, beta, gamma, period }: MovingFnSettings) =>
    `if (values.length > ${period || 1}*2) {MovingFunctions.holtWinters(values, ${alpha || 0.3}, ${beta ||
      0.1}, ${gamma || 0.3}, ${period || 1}, false)}`,
  linear: () => 'MovingFunctions.linearWeightedAvg(values)',
};

const buildScript = (model: ModelType, settings: MovingFnSettings) => {
  switch (model) {
    case 'ewma':
      return scriptFunctions.ewma(settings);
    case 'holt':
      return scriptFunctions.holt(settings);
    case 'holt_winters':
      return scriptFunctions.holtWinters(settings);
    case 'linear':
      return scriptFunctions.linear();
    default:
      return scriptFunctions.simple();
  }
};

export const convertMovingAvgToMovingFn = (metric: MovingAvgMetric) => {
  const { window, model, settings } = metric.settings;
  return {
    buckets_path: metric.pipelineAgg,
    script: buildScript(model, settings || {}),
    window,
  };
};
