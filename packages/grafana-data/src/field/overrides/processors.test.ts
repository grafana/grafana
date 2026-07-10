import { type FieldOverrideContext } from '../../types/fieldOverrides';
import { type InterpolateFunction } from '../../types/panel';
import { ThresholdsMode } from '../../types/thresholds';

import { interpolateNumericValue, numberOverrideProcessor, thresholdsOverrideProcessor } from './processors';

/**
 * Emulates the function-format calling convention shared by sceneGraph.interpolate and
 * templateSrv.replace: the custom format function receives the raw variable value,
 * which is an array for multi-value variables. Unknown variables are left as-is.
 */
function makeReplaceVariables(vars: Record<string, unknown>): InterpolateFunction {
  return (value, _scopedVars, format) => {
    return value.replace(/\$\{(\w+)\}|\$(\w+)/g, (match, braced, plain) => {
      const name = braced ?? plain;
      if (!(name in vars)) {
        return match;
      }
      const raw = vars[name];
      if (typeof format === 'function') {
        return format(raw);
      }
      return String(raw);
    });
  };
}

function makeContext(vars?: Record<string, unknown>): FieldOverrideContext {
  return {
    data: [],
    replaceVariables: vars ? makeReplaceVariables(vars) : undefined,
  };
}

describe('interpolateNumericValue', () => {
  it('passes numbers through untouched', () => {
    expect(interpolateNumericValue(42, makeContext({}))).toBe(42);
    expect(interpolateNumericValue(-Infinity, makeContext({}))).toBe(-Infinity);
  });

  it('resolves a single-value variable', () => {
    expect(interpolateNumericValue('$t', makeContext({ t: '50' }))).toBe(50);
    expect(interpolateNumericValue('${t}', makeContext({ t: 50 }))).toBe(50);
  });

  it('accepts a multi-value variable with exactly one value selected', () => {
    expect(interpolateNumericValue('$multi', makeContext({ multi: ['25'] }))).toBe(25);
  });

  it('rejects a multi-value variable with more than one value selected', () => {
    expect(interpolateNumericValue('$multi', makeContext({ multi: ['25', '75'] }))).toBeUndefined();
  });

  it('rejects an unknown variable', () => {
    expect(interpolateNumericValue('$nope', makeContext({}))).toBeUndefined();
  });

  it('rejects a variable with a non-numeric value', () => {
    expect(interpolateNumericValue('$word', makeContext({ word: 'hello' }))).toBeUndefined();
  });

  it('rejects strings when replaceVariables is not available', () => {
    expect(interpolateNumericValue('$t', makeContext())).toBeUndefined();
  });
});

describe('numberOverrideProcessor', () => {
  it('returns undefined for null and undefined', () => {
    expect(numberOverrideProcessor(null, makeContext({}))).toBeUndefined();
    expect(numberOverrideProcessor(undefined, makeContext({}))).toBeUndefined();
  });

  it('parses plain numbers and numeric strings', () => {
    expect(numberOverrideProcessor(3.5, makeContext({}))).toBe(3.5);
    expect(numberOverrideProcessor('3.5', makeContext({}))).toBe(3.5);
  });

  it('interpolates a variable expression', () => {
    expect(numberOverrideProcessor('$min', makeContext({ min: '10' }))).toBe(10);
  });

  it('returns undefined (option unset) for an unknown variable', () => {
    expect(numberOverrideProcessor('$nope', makeContext({}))).toBeUndefined();
  });

  it('returns undefined (option unset) for a non-numeric variable value', () => {
    expect(numberOverrideProcessor('$word', makeContext({ word: 'hello' }))).toBeUndefined();
  });

  it('returns undefined (option unset) for a multi-value variable with more than one value', () => {
    expect(numberOverrideProcessor('$multi', makeContext({ multi: [1, 2] }))).toBeUndefined();
  });

  it('accepts a multi-value variable with a single selected value', () => {
    expect(numberOverrideProcessor('$multi', makeContext({ multi: ['7'] }))).toBe(7);
  });

  it('returns undefined (option unset) when replaceVariables is missing', () => {
    expect(numberOverrideProcessor('$min', makeContext())).toBeUndefined();
  });
});

describe('thresholdsOverrideProcessor', () => {
  const baseStep = { value: -Infinity, color: 'green' };

  it('returns purely numeric configs untouched', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 80, color: 'red' }],
    };

    expect(thresholdsOverrideProcessor(value, makeContext({}))).toBe(value);
  });

  it('passes through null/undefined values', () => {
    expect(thresholdsOverrideProcessor(null, makeContext({}))).toBeNull();
    expect(thresholdsOverrideProcessor(undefined, makeContext({}))).toBeUndefined();
  });

  it('interpolates variable steps and re-sorts ascending, keeping the base step first', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 80, color: 'red' }, { value: '$low', color: 'yellow' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ low: '10' }));

    expect(result.steps).toEqual([baseStep, { value: 10, color: 'yellow' }, { value: 80, color: 'red' }]);
  });

  it('accepts a multi-value variable with exactly one selected value', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: '$multi', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ multi: ['42'] }));

    expect(result.steps).toEqual([baseStep, { value: 42, color: 'red' }]);
  });

  it('drops steps for multi-value variables with more than one selected value', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 50, color: 'yellow' }, { value: '$multi', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ multi: ['1', '2'] }));

    expect(result.steps).toEqual([baseStep, { value: 50, color: 'yellow' }]);
  });

  it('drops steps for unknown variables', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: '$nope', color: 'red' }, { value: 50, color: 'yellow' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({}));

    expect(result.steps).toEqual([baseStep, { value: 50, color: 'yellow' }]);
  });

  it('drops steps for non-numeric variable values', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: '$word', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ word: 'hello' }));

    expect(result.steps).toEqual([baseStep]);
  });

  it('drops variable steps when replaceVariables is missing', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: '$t', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext());

    expect(result.steps).toEqual([baseStep]);
  });

  it('keeps the base step first even when variables resolve below other steps', () => {
    const value = {
      mode: ThresholdsMode.Percentage,
      steps: [baseStep, { value: '$high', color: 'red' }, { value: 50, color: 'yellow' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ high: 90 }));

    expect(result.mode).toBe(ThresholdsMode.Percentage);
    expect(result.steps).toEqual([baseStep, { value: 50, color: 'yellow' }, { value: 90, color: 'red' }]);
  });

  it('does not mutate the raw config', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: '$t', color: 'red' }],
    };
    const stepsCopy = [...value.steps.map((s) => ({ ...s }))];

    thresholdsOverrideProcessor(value, makeContext({ t: '5' }));

    expect(value.steps).toEqual(stepsCopy);
  });
});
