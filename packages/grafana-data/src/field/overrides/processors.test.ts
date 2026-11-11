import { type FieldOverrideContext } from '../../types/fieldOverrides';
import { type InterpolateFunction } from '../../types/panel';
import { ThresholdsMode } from '../../types/thresholds';

import {
  getVarMappingKind,
  hasVarMappingVariableReference,
  isInVarMappingRange,
  isVarMappingExpressionInput,
  numberOverrideProcessor,
  resolveVarMapping,
  resolveVarMappingString,
  stringOverrideProcessor,
  thresholdsOverrideProcessor,
} from './processors';

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

  it('falls back for a number outside the settings range, and floors integer settings', () => {
    expect(resolveVarMapping('$t', makeContext({ t: '150' }), { min: 0, max: 100 })).toBeUndefined();
    expect(resolveVarMapping('$t', makeContext({ t: '100' }), { min: 0, max: 100 })).toBe(100);
    expect(resolveVarMapping('$t', makeContext({ t: '2.7' }), { integer: true })).toBe(2);
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

describe('resolveVarMapping', () => {
  it('resolves a single-value variable to a number', () => {
    expect(resolveVarMapping('$t', makeContext({ t: '50' }))).toBe(50);
  });

  it('resolves ${var} syntax and numbers passed as raw values', () => {
    expect(resolveVarMapping('${t}', makeContext({ t: 50 }))).toBe(50);
  });

  it('accepts a multi-value variable with exactly one selected value', () => {
    expect(resolveVarMapping('$multi', makeContext({ multi: ['42'] }))).toBe(42);
  });

  it('falls back (returns undefined) for a multi-value variable with more than one selected value', () => {
    expect(resolveVarMapping('$multi', makeContext({ multi: ['25', '75'] }))).toBeUndefined();
  });

  it('falls back for an unknown variable', () => {
    expect(resolveVarMapping('$nope', makeContext({}))).toBeUndefined();
  });

  it('parses strictly: values like "80ms" fall back instead of parsing as 80', () => {
    expect(resolveVarMapping('$latency', makeContext({ latency: '80ms' }))).toBeUndefined();
  });

  it('falls back when the expression resolves to an empty string', () => {
    expect(resolveVarMapping('$empty', makeContext({ empty: '  ' }))).toBeUndefined();
  });

  it('accepts numeric values with surrounding whitespace', () => {
    expect(resolveVarMapping('$padded', makeContext({ padded: ' 42 ' }))).toBe(42);
  });

  it('falls back when context.replaceVariables is missing', () => {
    expect(resolveVarMapping('$t', makeContext())).toBeUndefined();
  });
});

describe('resolveVarMappingString', () => {
  it('resolves a single-value variable to its trimmed text', () => {
    expect(resolveVarMappingString('$unit', makeContext({ unit: ' percent ' }))).toBe('percent');
  });

  it('resolves text around the variable', () => {
    expect(resolveVarMappingString('suffix:${unit}/s', makeContext({ unit: 'req' }))).toBe('suffix:req/s');
  });

  it('accepts a multi-value variable with exactly one selected value', () => {
    expect(resolveVarMappingString('$unit', makeContext({ unit: ['bytes'] }))).toBe('bytes');
  });

  it('falls back for a multi-value variable with more than one selected value', () => {
    expect(resolveVarMappingString('$unit', makeContext({ unit: ['bytes', 'percent'] }))).toBeUndefined();
  });

  it('falls back for a multi-value variable with no selected value', () => {
    expect(resolveVarMappingString('$unit', makeContext({ unit: [] }))).toBeUndefined();
  });

  it('falls back for an unknown variable, alone or next to a known one', () => {
    expect(resolveVarMappingString('$nope', makeContext({}))).toBeUndefined();
    expect(resolveVarMappingString('${unit}$nope', makeContext({ unit: 'bytes' }))).toBeUndefined();
  });

  it('falls back when the result is empty', () => {
    expect(resolveVarMappingString('$unit', makeContext({ unit: '  ' }))).toBeUndefined();
  });

  it('keeps a resolved custom unit that contains a $ outside variable syntax', () => {
    expect(resolveVarMappingString('$unit', makeContext({ unit: 'prefix:$' }))).toBe('prefix:$');
    expect(resolveVarMappingString('$unit', makeContext({ unit: 'suffix: $' }))).toBe('suffix: $');
  });

  it('falls back when a resolved custom unit has a $ followed by a word character', () => {
    // indistinguishable from a variable the interpolator didn't find
    expect(resolveVarMappingString('$unit', makeContext({ unit: 'suffix:$k' }))).toBeUndefined();
    expect(resolveVarMappingString('$unit', makeContext({ unit: 'prefix:$5' }))).toBeUndefined();
  });

  it('falls back when the resolved value is itself variable syntax', () => {
    expect(resolveVarMappingString('$unit', makeContext({ unit: '$bad' }))).toBeUndefined();
    expect(resolveVarMappingString('$unit', makeContext({ unit: '[[bad]]' }))).toBeUndefined();
  });

  it('falls back when context.replaceVariables is missing', () => {
    expect(resolveVarMappingString('$unit', makeContext())).toBeUndefined();
  });
});

describe('getVarMappingKind', () => {
  it('resolves numeric properties to numbers', () => {
    expect(getVarMappingKind({ id: 'min', process: numberOverrideProcessor })).toBe('number');
    expect(getVarMappingKind({ id: 'custom.lineWidth', process: numberOverrideProcessor })).toBe('number');
  });

  it('resolves only the standard unit to a string', () => {
    expect(getVarMappingKind({ id: 'unit', process: stringOverrideProcessor })).toBe('string');
    expect(getVarMappingKind({ id: 'noValue', process: stringOverrideProcessor })).toBeUndefined();
    expect(getVarMappingKind({ id: 'custom.unit', process: stringOverrideProcessor })).toBeUndefined();
  });
});

describe('isVarMappingExpressionInput', () => {
  it('treats any string from a number editor as an expression', () => {
    expect(isVarMappingExpressionInput('number', '$min')).toBe(true);
    expect(isVarMappingExpressionInput('number', 5)).toBe(false);
  });

  it('treats a unit as an expression only when it contains variable syntax', () => {
    expect(isVarMappingExpressionInput('string', '$unit')).toBe(true);
    expect(isVarMappingExpressionInput('string', 'suffix:${unit}')).toBe(true);
    expect(isVarMappingExpressionInput('string', 'bytes')).toBe(false);
    expect(isVarMappingExpressionInput('string', 'prefix:$')).toBe(false);
    expect(isVarMappingExpressionInput('string', '')).toBe(false);
  });
});

describe('isInVarMappingRange', () => {
  it('checks the min and max that are set', () => {
    expect(isInVarMappingRange(10, { min: 0, max: 10 })).toBe(true);
    expect(isInVarMappingRange(11, { min: 0, max: 10 })).toBe(false);
    expect(isInVarMappingRange(-1, { min: 0 })).toBe(false);
    expect(isInVarMappingRange(-1, undefined)).toBe(true);
  });
});

describe('hasVarMappingVariableReference', () => {
  it('finds $var, ${var} and [[var]] references, but not a lone or literal $', () => {
    expect(hasVarMappingVariableReference('$b')).toBe(true);
    expect(hasVarMappingVariableReference('${b}')).toBe(true);
    expect(hasVarMappingVariableReference('[[b]]')).toBe(true);
    expect(hasVarMappingVariableReference('$')).toBe(false);
    expect(hasVarMappingVariableReference('prefix:$')).toBe(false);
  });
});
