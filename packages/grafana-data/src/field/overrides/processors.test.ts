import { type FieldOverrideContext } from '../../types/fieldOverrides';
import { type InterpolateFunction } from '../../types/panel';
import { ThresholdsMode } from '../../types/thresholds';

import { thresholdsOverrideProcessor } from './processors';

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

describe('thresholdsOverrideProcessor', () => {
  const baseStep = { value: -Infinity, color: 'green' };

  it('returns configs without valueExpr untouched (same reference)', () => {
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

  it('resolves valueExpr steps and re-sorts ascending, keeping the base step first', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 80, color: 'red' }, { value: 20, valueExpr: '$low', color: 'yellow' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ low: '10' }));

    expect(result.steps).toEqual([baseStep, { value: 10, color: 'yellow' }, { value: 80, color: 'red' }]);
  });

  it('resolves ${var} syntax and numbers passed as raw values', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 1, valueExpr: '${t}', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ t: 50 }));

    expect(result.steps).toEqual([baseStep, { value: 50, color: 'red' }]);
  });

  it('falls back to the numeric value for unknown variables', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 70, valueExpr: '$nope', color: 'red' }, { value: 50, color: 'yellow' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({}));

    expect(result.steps).toEqual([baseStep, { value: 50, color: 'yellow' }, { value: 70, color: 'red' }]);
  });

  it('falls back to the numeric value for non-numeric variable values', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 30, valueExpr: '$word', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ word: 'hello' }));

    expect(result.steps).toEqual([baseStep, { value: 30, color: 'red' }]);
  });

  it('falls back to the numeric value when the expression resolves to an empty string', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 30, valueExpr: '$empty', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ empty: '  ' }));

    expect(result.steps).toEqual([baseStep, { value: 30, color: 'red' }]);
  });

  it('parses strictly: values like "80ms" fall back instead of parsing as 80', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 30, valueExpr: '$latency', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ latency: '80ms' }));

    expect(result.steps).toEqual([baseStep, { value: 30, color: 'red' }]);
  });

  it('accepts numeric values with surrounding whitespace', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 30, valueExpr: '$padded', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ padded: ' 42 ' }));

    expect(result.steps).toEqual([baseStep, { value: 42, color: 'red' }]);
  });

  it('falls back to the numeric value for multi-value variables with more than one selected value', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 50, color: 'yellow' }, { value: 90, valueExpr: '$multi', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ multi: ['25', '75'] }));

    expect(result.steps).toEqual([baseStep, { value: 50, color: 'yellow' }, { value: 90, color: 'red' }]);
  });

  it('accepts a multi-value variable with exactly one selected value', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 90, valueExpr: '$multi', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ multi: ['42'] }));

    expect(result.steps).toEqual([baseStep, { value: 42, color: 'red' }]);
  });

  it('falls back to the numeric value when replaceVariables is missing', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 30, valueExpr: '$t', color: 'red' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext());

    expect(result.steps).toEqual([baseStep, { value: 30, color: 'red' }]);
  });

  it('keeps the base step first even when expressions resolve below other steps', () => {
    const value = {
      mode: ThresholdsMode.Percentage,
      steps: [baseStep, { value: 95, valueExpr: '$high', color: 'red' }, { value: 50, color: 'yellow' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ high: 90 }));

    expect(result.mode).toBe(ThresholdsMode.Percentage);
    expect(result.steps).toEqual([baseStep, { value: 50, color: 'yellow' }, { value: 90, color: 'red' }]);
  });

  it('ignores and strips a valueExpr on the base step', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, valueExpr: '$t', color: 'green' },
        { value: 30, valueExpr: '$t', color: 'red' },
      ],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ t: '50' }));

    expect(result.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 50, color: 'red' },
    ]);
  });

  it('strips valueExpr from every output step, including fallbacks', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 30, valueExpr: '$nope', color: 'red' }, { value: 60, valueExpr: '$t', color: 'blue' }],
    };

    const result = thresholdsOverrideProcessor(value, makeContext({ t: '50' }));

    for (const step of result.steps) {
      expect(step).not.toHaveProperty('valueExpr');
    }
  });

  it('does not mutate the raw config', () => {
    const value = {
      mode: ThresholdsMode.Absolute,
      steps: [baseStep, { value: 90, valueExpr: '$t', color: 'red' }, { value: 30, color: 'yellow' }],
    };
    const stepsCopy = value.steps.map((s) => ({ ...s }));

    thresholdsOverrideProcessor(value, makeContext({ t: '5' }));

    expect(value.steps).toEqual(stepsCopy);
  });
});
