import { darkenColor, emphasizeColor, intensifyColor, lightenColor } from './cssColor';

type Channels = { r: number; g: number; b: number };

// jsdom doesn't compute relative color syntax, so these tests evaluate the channel expressions of
// `rgb(from <color> calc(…) calc(…) calc(…) / alpha)` themselves. The expressions only use numbers, the r, g and b
// channels, + - * /, parentheses, and the calc, clamp and pow functions.
const evaluateExpression = (expression: string, channels: Channels): number => {
  const tokens = expression.match(/\d*\.?\d+|[a-z]+|[-+*/(),]/g) ?? [];
  let position = 0;

  const next = () => tokens[position++];
  const peek = () => tokens[position];
  const consume = (token: string) => {
    if (next() !== token) {
      throw new Error(`Expected ${token} at token ${position} of ${expression}`);
    }
  };

  const parseArguments = () => {
    consume('(');
    const args = [parseSum()];
    while (peek() === ',') {
      next();
      args.push(parseSum());
    }
    consume(')');
    return args;
  };

  const parseFactor = (): number => {
    const token = next();

    if (token === '-') {
      return -parseFactor();
    }
    if (token === '(') {
      const value = parseSum();
      consume(')');
      return value;
    }
    if (token === 'r' || token === 'g' || token === 'b') {
      return channels[token];
    }
    if (token === 'calc') {
      const [value] = parseArguments();
      return value;
    }
    if (token === 'clamp') {
      const [min, value, max] = parseArguments();
      return Math.min(Math.max(value, min), max);
    }
    if (token === 'pow') {
      const [base, exponent] = parseArguments();
      return Math.pow(base, exponent);
    }
    if (token !== undefined && /^[\d.]/.test(token)) {
      return Number(token);
    }

    throw new Error(`Unexpected token ${token} in ${expression}`);
  };

  const parseProduct = () => {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      value = next() === '*' ? value * parseFactor() : value / parseFactor();
    }
    return value;
  };

  const parseSum = (): number => {
    let value = parseProduct();
    while (peek() === '+' || peek() === '-') {
      value = next() === '+' ? value + parseProduct() : value - parseProduct();
    }
    return value;
  };

  const value = parseSum();
  if (position !== tokens.length) {
    throw new Error(`Unparsed tokens after token ${position} in ${expression}`);
  }
  return value;
};

// Splits `rgb(from <color> calc(…) calc(…) calc(…) / alpha)` into its color and its three channel expressions.
const parseRelativeColor = (css: string) => {
  const prefix = 'rgb(from ';
  const suffix = ' / alpha)';
  expect(css.startsWith(prefix)).toBe(true);
  expect(css.endsWith(suffix)).toBe(true);

  const body = css.slice(prefix.length, -suffix.length);
  const expressions: string[] = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < body.length; index++) {
    if (depth === 0 && body.startsWith('calc(', index)) {
      start = index;
    }
    if (body[index] === '(') {
      depth++;
    } else if (body[index] === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        expressions.push(body.slice(start, index + 1));
        start = -1;
      }
    }
  }

  expect(expressions).toHaveLength(3);
  return { color: body.slice(0, body.indexOf(' calc(')), expressions };
};

// Applies a cssColor function to a color given by its channels, and returns the channels that a browser computes.
const compute = (fn: (color: string, coefficient: number) => string, channels: Channels, coefficient: number) => {
  const { expressions } = parseRelativeColor(fn(`rgb(${channels.r} ${channels.g} ${channels.b})`, coefficient));
  const [r, g, b] = expressions.map((expression) => evaluateExpression(expression, channels));
  return { r, g, b };
};

const expectChannels = (actual: Channels, expected: Channels) => {
  expect(actual.r).toBeCloseTo(expected.r, 6);
  expect(actual.g).toBeCloseTo(expected.g, 6);
  expect(actual.b).toBeCloseTo(expected.b, 6);
};

// Relative luminance 0.22, so it counts as dark.
const orange = { r: 200, g: 100, b: 40 };
const darkenedOrange = { r: 150, g: 75, b: 30 };
const lightenedOrange = { r: 213.75, g: 138.75, b: 93.75 };

// A gray has relative luminance 0.5 at sRGB channel 187.5, so 188 counts as light and 187 as dark.
const lightGray = { r: 188, g: 188, b: 188 };
const darkGray = { r: 187, g: 187, b: 187 };

describe('cssColor', () => {
  describe.each([
    ['darkenColor', darkenColor],
    ['lightenColor', lightenColor],
    ['intensifyColor', intensifyColor],
    ['emphasizeColor', emphasizeColor],
  ])('%s', (_, fn) => {
    it('builds the color from the input color and keeps its alpha', () => {
      expect(parseRelativeColor(fn('oklch(70% 0.1 200 / 50%)', 0.25)).color).toBe('oklch(70% 0.1 200 / 50%)');
    });

    it('leaves the color unchanged with a coefficient of 0', () => {
      expectChannels(compute(fn, orange, 0), orange);
    });
  });

  describe('darkenColor', () => {
    it('moves each channel towards 0 by the coefficient', () => {
      expectChannels(compute(darkenColor, orange, 0.25), darkenedOrange);
    });

    it('returns black with a coefficient of 1', () => {
      expectChannels(compute(darkenColor, orange, 1), { r: 0, g: 0, b: 0 });
    });
  });

  describe('lightenColor', () => {
    it('moves each channel towards 255 by the coefficient', () => {
      expectChannels(compute(lightenColor, orange, 0.25), lightenedOrange);
    });

    it('returns white with a coefficient of 1', () => {
      expectChannels(compute(lightenColor, orange, 1), { r: 255, g: 255, b: 255 });
    });
  });

  describe('emphasizeColor', () => {
    it('darkens a color whose relative luminance is above 0.5', () => {
      expectChannels(compute(emphasizeColor, lightGray, 0.5), { r: 94, g: 94, b: 94 });
    });

    it('lightens a color whose relative luminance is 0.5 or below', () => {
      expectChannels(compute(emphasizeColor, darkGray, 0.5), { r: 221, g: 221, b: 221 });
      expectChannels(compute(emphasizeColor, orange, 0.25), lightenedOrange);
    });

    // Relative luminance weights green most and blue least, so pure green counts as light, and pure red and pure blue
    // as dark, although each has one channel at 255.
    it('weights the channels by their contribution to relative luminance', () => {
      expectChannels(compute(emphasizeColor, { r: 0, g: 255, b: 0 }, 0.5), { r: 0, g: 127.5, b: 0 });
      expectChannels(compute(emphasizeColor, { r: 255, g: 0, b: 0 }, 0.5), { r: 255, g: 127.5, b: 127.5 });
      expectChannels(compute(emphasizeColor, { r: 0, g: 0, b: 255 }, 0.5), { r: 127.5, g: 127.5, b: 255 });
    });

    // rgb(120 210 120) has relative luminance 0.514. Its red and blue channels are on the curved part of the sRGB
    // transfer function, and treating them as linear would put it at 0.471.
    it('linearizes mid-range channels with the sRGB curve', () => {
      expectChannels(compute(emphasizeColor, { r: 120, g: 210, b: 120 }, 0.5), { r: 60, g: 105, b: 60 });
    });

    it('lightens a very dark color, whose channels are on the linear part of the sRGB curve', () => {
      expectChannels(compute(emphasizeColor, { r: 5, g: 5, b: 5 }, 0.5), { r: 130, g: 130, b: 130 });
    });
  });

  describe('intensifyColor', () => {
    it('lightens a color whose relative luminance is above 0.5', () => {
      expectChannels(compute(intensifyColor, lightGray, 0.5), { r: 221.5, g: 221.5, b: 221.5 });
    });

    it('darkens a color whose relative luminance is 0.5 or below', () => {
      expectChannels(compute(intensifyColor, darkGray, 0.5), { r: 93.5, g: 93.5, b: 93.5 });
      expectChannels(compute(intensifyColor, orange, 0.25), darkenedOrange);
    });

    it('moves a color the opposite way to emphasizeColor', () => {
      expectChannels(compute(intensifyColor, { r: 0, g: 255, b: 0 }, 0.5), { r: 127.5, g: 255, b: 127.5 });
      expectChannels(compute(intensifyColor, { r: 255, g: 0, b: 0 }, 0.5), { r: 127.5, g: 0, b: 0 });
    });
  });
});
