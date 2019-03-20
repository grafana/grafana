// Vendored and converted to TS, source: https://github.com/xpl/ansicolor/blob/b82360563ed29de444dc7618b9236191e0a77096/ansicolor.js
// License: Unlicense, author: https://github.com/xpl

const O = Object;

/*  See https://misc.flogisoft.com/bash/tip_colors_and_formatting
    ------------------------------------------------------------------------ */

const colorCodes = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'lightGray', '', 'default'],
  colorCodesLight = [
    'darkGray',
    'lightRed',
    'lightGreen',
    'lightYellow',
    'lightBlue',
    'lightMagenta',
    'lightCyan',
    'white',
    '',
  ],
  styleCodes = ['', 'bright', 'dim', 'italic', 'underline', '', '', 'inverse'],
  asBright = {
    red: 'lightRed',
    green: 'lightGreen',
    yellow: 'lightYellow',
    blue: 'lightBlue',
    magenta: 'lightMagenta',
    cyan: 'lightCyan',
    black: 'darkGray',
    lightGray: 'white',
  },
  types = {
    0: 'style',
    2: 'unstyle',
    3: 'color',
    9: 'colorLight',
    4: 'bgColor',
    10: 'bgColorLight',
  },
  subtypes = {
    color: colorCodes,
    colorLight: colorCodesLight,
    bgColor: colorCodes,
    bgColorLight: colorCodesLight,
    style: styleCodes,
    unstyle: styleCodes,
  };

/*  ------------------------------------------------------------------------ */

const clean = (obj: any) => {
  for (const k in obj) {
    if (!obj[k]) {
      delete obj[k];
    }
  }
  return O.keys(obj).length === 0 ? undefined : obj;
};

/*  ------------------------------------------------------------------------ */

class Color {
  background: boolean;
  name: string;
  brightness: number;

  constructor(background?: boolean, name?: string, brightness?: number) {
    this.background = background;
    this.name = name;
    this.brightness = brightness;
  }

  get inverse() {
    return new Color(!this.background, this.name || (this.background ? 'black' : 'white'), this.brightness);
  }

  get clean() {
    return clean({
      name: this.name === 'default' ? '' : this.name,
      bright: this.brightness === Code.bright,
      dim: this.brightness === Code.dim,
    });
  }

  defaultBrightness(value: number) {
    return new Color(this.background, this.name, this.brightness || value);
  }

  css(inverted: boolean) {
    const color = inverted ? this.inverse : this;

    // @ts-ignore
    const rgbName = (color.brightness === Code.bright && asBright[color.name]) || color.name;

    const prop = color.background ? 'background:' : 'color:';

    // @ts-ignore
    const rgb = Colors.rgb[rgbName];
    const alpha = this.brightness === Code.dim ? 0.5 : 1;

    return rgb
      ? prop + 'rgba(' + [...rgb, alpha].join(',') + ');'
      : !color.background && alpha < 1 ? 'color:rgba(0,0,0,0.5);' : ''; // Chrome does not support 'opacity' property...
  }
}

/*  ------------------------------------------------------------------------ */

class Code {
  static reset = 0;
  static bright = 1;
  static dim = 2;
  static inverse = 7;
  static noBrightness = 22;
  static noItalic = 23;
  static noUnderline = 24;
  static noInverse = 27;
  static noColor = 39;
  static noBgColor = 49;

  value: number;

  constructor(n?: string | number) {
    if (n !== undefined) {
      this.value = Number(n);
    }
  }

  get type() {
    // @ts-ignore
    return types[Math.floor(this.value / 10)];
  }

  get subtype() {
    // @ts-ignore
    return subtypes[this.type][this.value % 10];
  }

  get str() {
    return this.value ? '\u001b[' + this.value + 'm' : '';
  }

  static str(x: string | number) {
    return new Code(x).str;
  }

  get isBrightness() {
    return this.value === Code.noBrightness || this.value === Code.bright || this.value === Code.dim;
  }
}

/*  ------------------------------------------------------------------------ */

const replaceAll = (str: string, a: string, b: string) => str.split(a).join(b);

/*  ANSI brightness codes do not overlap, e.g. "{bright}{dim}foo" will be rendered bright (not dim).
    So we fix it by adding brightness canceling before each brightness code, so the former example gets
    converted to "{noBrightness}{bright}{noBrightness}{dim}foo" – this way it gets rendered as expected.
 */

const denormalizeBrightness = (s: string) => s.replace(/(\u001b\[(1|2)m)/g, '\u001b[22m$1');
const normalizeBrightness = (s: string) => s.replace(/\u001b\[22m(\u001b\[(1|2)m)/g, '$1');

// @ts-ignore
const wrap = (x, openCode, closeCode) => {
  const open = Code.str(openCode),
    close = Code.str(closeCode);

  return String(x)
    .split('\n')
    .map(line => denormalizeBrightness(open + replaceAll(normalizeBrightness(line), close, open) + close))
    .join('\n');
};

/*  ------------------------------------------------------------------------ */

const camel = (a: string, b: string) => a + b.charAt(0).toUpperCase() + b.slice(1);

const stringWrappingMethods = (() =>
  [
    ...colorCodes.map(
      (k, i) =>
        !k
          ? []
          : [
              // color methods

              [k, 30 + i, Code.noColor],
              [camel('bg', k), 40 + i, Code.noBgColor],
            ]
    ),

    ...colorCodesLight.map(
      (k, i) =>
        !k
          ? []
          : [
              // light color methods

              [k, 90 + i, Code.noColor],
              [camel('bg', k), 100 + i, Code.noBgColor],
            ]
    ),

    /* THIS ONE IS FOR BACKWARDS COMPATIBILITY WITH PREVIOUS VERSIONS (had 'bright' instead of 'light' for backgrounds)
         */
    ...['', 'BrightRed', 'BrightGreen', 'BrightYellow', 'BrightBlue', 'BrightMagenta', 'BrightCyan'].map(
      (k, i) => (!k ? [] : [['bg' + k, 100 + i, Code.noBgColor]])
    ),

    ...styleCodes.map(
      (k, i) =>
        !k
          ? []
          : [
              // style methods

              [k, i, k === 'bright' || k === 'dim' ? Code.noBrightness : 20 + i],
            ]
    ),
  ].reduce((a, b) => a.concat(b)))();

/*  ------------------------------------------------------------------------ */

// @ts-ignore
const assignStringWrappingAPI = (target, wrapBefore = target) =>
  stringWrappingMethods.reduce(
    (memo, [k, open, close]) =>
      O.defineProperty(memo, k, {
        // @ts-ignore
        get: () => assignStringWrappingAPI(str => wrapBefore(wrap(str, open, close))),
      }),

    target
  );

/*  ------------------------------------------------------------------------ */

const TEXT = 0,
  BRACKET = 1,
  CODE = 2;

function rawParse(s: string) {
  let state = TEXT,
    buffer = '',
    text = '',
    code = '',
    codes = [];
  const spans = [];

  for (let i = 0, n = s.length; i < n; i++) {
    const c = s[i];

    buffer += c;

    switch (state) {
      case TEXT: {
        if (c === '\u001b') {
          state = BRACKET;
          buffer = c;
        } else {
          text += c;
        }
        break;
      }
      case BRACKET:
        if (c === '[') {
          state = CODE;
          code = '';
          codes = [];
        } else {
          state = TEXT;
          text += buffer;
        }
        break;

      case CODE:
        if (c >= '0' && c <= '9') {
          code += c;
        } else if (c === ';') {
          codes.push(new Code(code));
          code = '';
        } else if (c === 'm' && code.length) {
          codes.push(new Code(code));
          for (const code of codes) {
            spans.push({ text, code });
            text = '';
          }
          state = TEXT;
        } else {
          state = TEXT;
          text += buffer;
        }
    }
  }

  if (state !== TEXT) {
    text += buffer;
  }

  if (text) {
    spans.push({ text, code: new Code() });
  }

  return spans;
}

/*  ------------------------------------------------------------------------ */

/**
 * Represents an ANSI-escaped string.
 */
export default class Colors {
  spans: any[];
  static names = stringWrappingMethods.map(([k]) => k);
  static rgb = {
    black: [0, 0, 0],
    darkGray: [100, 100, 100],
    lightGray: [200, 200, 200],
    white: [255, 255, 255],

    red: [204, 0, 0],
    lightRed: [255, 51, 0],

    green: [0, 204, 0],
    lightGreen: [51, 204, 51],

    yellow: [204, 102, 0],
    lightYellow: [255, 153, 51],

    blue: [0, 0, 255],
    lightBlue: [26, 140, 255],

    magenta: [204, 0, 204],
    lightMagenta: [255, 0, 255],

    cyan: [0, 153, 255],
    lightCyan: [0, 204, 255],
  };

  /**
   * @param {string} s a string containing ANSI escape codes.
   */
  constructor(s?: string) {
    this.spans = s ? rawParse(s) : [];
  }

  get str() {
    return this.spans.reduce((str, p) => str + p.text + p.code.str, '');
  }

  get parsed() {
    let styles: Set<string>;
    let brightness: number;
    let color: Color;
    let bgColor: Color;

    function reset() {
      (color = new Color()),
        (bgColor = new Color(true /* background */)),
        (brightness = undefined),
        (styles = new Set());
    }

    reset();

    return O.assign(new Colors(), {
      spans: this.spans
        .map(span => {
          const c = span.code;

          const inverted = styles.has('inverse'),
            underline = styles.has('underline') ? 'text-decoration: underline;' : '',
            italic = styles.has('italic') ? 'font-style: italic;' : '',
            bold = brightness === Code.bright ? 'font-weight: bold;' : '';

          const foreColor = color.defaultBrightness(brightness);

          const styledSpan = O.assign(
            { css: bold + italic + underline + foreColor.css(inverted) + bgColor.css(inverted) },
            clean({ bold: !!bold, color: foreColor.clean, bgColor: bgColor.clean }),
            span
          );

          for (const k of styles) {
            styledSpan[k] = true;
          }

          if (c.isBrightness) {
            brightness = c.value;
          } else if (span.code.value !== undefined) {
            if (span.code.value === Code.reset) {
              reset();
            } else {
              switch (span.code.type) {
                case 'color':
                case 'colorLight':
                  color = new Color(false, c.subtype);
                  break;

                case 'bgColor':
                case 'bgColorLight':
                  bgColor = new Color(true, c.subtype);
                  break;

                case 'style':
                  styles.add(c.subtype);
                  break;
                case 'unstyle':
                  styles.delete(c.subtype);
                  break;
              }
            }
          }

          return styledSpan;
        })
        .filter(s => s.text.length > 0),
    });
  }

  /*  Outputs with Chrome DevTools-compatible format     */

  get asChromeConsoleLogArguments() {
    const spans = this.parsed.spans;

    return [spans.map(s => '%c' + s.text).join(''), ...spans.map(s => s.css)];
  }

  get browserConsoleArguments() /* LEGACY, DEPRECATED */ {
    return this.asChromeConsoleLogArguments;
  }

  /**
   * @desc installs String prototype extensions
   * @example
   * require ('ansicolor').nice
   * console.log ('foo'.bright.red)
   */
  static get nice() {
    Colors.names.forEach(k => {
      if (!(k in String.prototype)) {
        O.defineProperty(String.prototype, k, {
          get: function() {
            // @ts-ignore
            return Colors[k](this);
          },
        });
      }
    });

    return Colors;
  }

  /**
   * @desc parses a string containing ANSI escape codes
   * @return {Colors} parsed representation.
   */
  static parse(s: string) {
    return new Colors(s).parsed;
  }

  /**
   * @desc strips ANSI codes from a string
   * @param {string} s a string containing ANSI escape codes.
   * @return {string} clean string.
   */
  static strip(s: string) {
    return s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g, ''); // hope V8 caches the regexp
  }

  /**
   * @example
   * const spans = [...ansi.parse ('\u001b[7m\u001b[7mfoo\u001b[7mbar\u001b[27m')]
   */
  [Symbol.iterator]() {
    return this.spans[Symbol.iterator]();
  }
}

/*  ------------------------------------------------------------------------ */

assignStringWrappingAPI(Colors, (str: string) => str);
