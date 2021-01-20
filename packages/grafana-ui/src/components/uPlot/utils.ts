import throttle from 'lodash/throttle';
import { Options } from 'uplot';
import { PlotPlugin, PlotProps } from './types';

const ALLOWED_FORMAT_STRINGS_REGEX = /\b(YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW|HH|H|h|AA|aa|a|mm|m|ss|s|fff)\b/g;

export const timeFormatToTemplate = (f: string) => {
  return f.replace(ALLOWED_FORMAT_STRINGS_REGEX, (match) => `{${match}}`);
};

export const buildPlotConfig = (props: PlotProps, plugins: Record<string, PlotPlugin>): Options => {
  return {
    width: props.width,
    height: props.height,
    focus: {
      alpha: 1,
    },
    cursor: {
      focus: {
        prox: 30,
      },
    },
    legend: {
      show: false,
    },
    plugins: Object.entries(plugins).map((p) => ({
      hooks: p[1].hooks,
    })),
    hooks: {},
  } as any;
};

export const isPlottingTime = (config: Options) => {
  let isTimeSeries = false;

  if (!config.scales) {
    return false;
  }

  for (let i = 0; i < Object.keys(config.scales).length; i++) {
    const key = Object.keys(config.scales)[i];
    if (config.scales[key].time === true) {
      isTimeSeries = true;
      break;
    }
  }

  return isTimeSeries;
};

// Dev helpers
export const throttledLog = throttle((...t: any[]) => {
  console.log(...t);
}, 500);

export const pluginLog = (id: string, throttle = false, ...t: any[]) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const fn = throttle ? throttledLog : console.log;
  fn(`[Plugin: ${id}]: `, ...t);
};
