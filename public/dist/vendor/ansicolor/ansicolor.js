// Vendored and converted to TS, source: https://github.com/xpl/ansicolor/blob/b82360563ed29de444dc7618b9236191e0a77096/ansicolor.js
// License: Unlicense, author: https://github.com/xpl
import * as tslib_1 from "tslib";
var O = Object;
/*  See https://misc.flogisoft.com/bash/tip_colors_and_formatting
    ------------------------------------------------------------------------ */
var colorCodes = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'lightGray', '', 'default'], colorCodesLight = [
    'darkGray',
    'lightRed',
    'lightGreen',
    'lightYellow',
    'lightBlue',
    'lightMagenta',
    'lightCyan',
    'white',
    '',
], styleCodes = ['', 'bright', 'dim', 'italic', 'underline', '', '', 'inverse'], asBright = {
    red: 'lightRed',
    green: 'lightGreen',
    yellow: 'lightYellow',
    blue: 'lightBlue',
    magenta: 'lightMagenta',
    cyan: 'lightCyan',
    black: 'darkGray',
    lightGray: 'white',
}, types = {
    0: 'style',
    2: 'unstyle',
    3: 'color',
    9: 'colorLight',
    4: 'bgColor',
    10: 'bgColorLight',
}, subtypes = {
    color: colorCodes,
    colorLight: colorCodesLight,
    bgColor: colorCodes,
    bgColorLight: colorCodesLight,
    style: styleCodes,
    unstyle: styleCodes,
};
/*  ------------------------------------------------------------------------ */
var clean = function (obj) {
    for (var k in obj) {
        if (!obj[k]) {
            delete obj[k];
        }
    }
    return O.keys(obj).length === 0 ? undefined : obj;
};
/*  ------------------------------------------------------------------------ */
var Color = /** @class */ (function () {
    function Color(background, name, brightness) {
        this.background = background;
        this.name = name;
        this.brightness = brightness;
    }
    Object.defineProperty(Color.prototype, "inverse", {
        get: function () {
            return new Color(!this.background, this.name || (this.background ? 'black' : 'white'), this.brightness);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Color.prototype, "clean", {
        get: function () {
            return clean({
                name: this.name === 'default' ? '' : this.name,
                bright: this.brightness === Code.bright,
                dim: this.brightness === Code.dim,
            });
        },
        enumerable: true,
        configurable: true
    });
    Color.prototype.defaultBrightness = function (value) {
        return new Color(this.background, this.name, this.brightness || value);
    };
    Color.prototype.css = function (inverted) {
        var color = inverted ? this.inverse : this;
        // @ts-ignore
        var rgbName = (color.brightness === Code.bright && asBright[color.name]) || color.name;
        var prop = color.background ? 'background:' : 'color:';
        // @ts-ignore
        var rgb = Colors.rgb[rgbName];
        var alpha = this.brightness === Code.dim ? 0.5 : 1;
        return rgb
            ? prop + 'rgba(' + tslib_1.__spread(rgb, [alpha]).join(',') + ');'
            : !color.background && alpha < 1 ? 'color:rgba(0,0,0,0.5);' : ''; // Chrome does not support 'opacity' property...
    };
    return Color;
}());
/*  ------------------------------------------------------------------------ */
var Code = /** @class */ (function () {
    function Code(n) {
        if (n !== undefined) {
            this.value = Number(n);
        }
    }
    Object.defineProperty(Code.prototype, "type", {
        get: function () {
            // @ts-ignore
            return types[Math.floor(this.value / 10)];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "subtype", {
        get: function () {
            // @ts-ignore
            return subtypes[this.type][this.value % 10];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "str", {
        get: function () {
            return this.value ? '\u001b[' + this.value + 'm' : '';
        },
        enumerable: true,
        configurable: true
    });
    Code.str = function (x) {
        return new Code(x).str;
    };
    Object.defineProperty(Code.prototype, "isBrightness", {
        get: function () {
            return this.value === Code.noBrightness || this.value === Code.bright || this.value === Code.dim;
        },
        enumerable: true,
        configurable: true
    });
    Code.reset = 0;
    Code.bright = 1;
    Code.dim = 2;
    Code.inverse = 7;
    Code.noBrightness = 22;
    Code.noItalic = 23;
    Code.noUnderline = 24;
    Code.noInverse = 27;
    Code.noColor = 39;
    Code.noBgColor = 49;
    return Code;
}());
/*  ------------------------------------------------------------------------ */
var replaceAll = function (str, a, b) { return str.split(a).join(b); };
/*  ANSI brightness codes do not overlap, e.g. "{bright}{dim}foo" will be rendered bright (not dim).
    So we fix it by adding brightness canceling before each brightness code, so the former example gets
    converted to "{noBrightness}{bright}{noBrightness}{dim}foo" – this way it gets rendered as expected.
 */
var denormalizeBrightness = function (s) { return s.replace(/(\u001b\[(1|2)m)/g, '\u001b[22m$1'); };
var normalizeBrightness = function (s) { return s.replace(/\u001b\[22m(\u001b\[(1|2)m)/g, '$1'); };
// @ts-ignore
var wrap = function (x, openCode, closeCode) {
    var open = Code.str(openCode), close = Code.str(closeCode);
    return String(x)
        .split('\n')
        .map(function (line) { return denormalizeBrightness(open + replaceAll(normalizeBrightness(line), close, open) + close); })
        .join('\n');
};
/*  ------------------------------------------------------------------------ */
var camel = function (a, b) { return a + b.charAt(0).toUpperCase() + b.slice(1); };
var stringWrappingMethods = (function () {
    return tslib_1.__spread(colorCodes.map(function (k, i) {
        return !k
            ? []
            : [
                // color methods
                [k, 30 + i, Code.noColor],
                [camel('bg', k), 40 + i, Code.noBgColor],
            ];
    }), colorCodesLight.map(function (k, i) {
        return !k
            ? []
            : [
                // light color methods
                [k, 90 + i, Code.noColor],
                [camel('bg', k), 100 + i, Code.noBgColor],
            ];
    }), ['', 'BrightRed', 'BrightGreen', 'BrightYellow', 'BrightBlue', 'BrightMagenta', 'BrightCyan'].map(function (k, i) { return (!k ? [] : [['bg' + k, 100 + i, Code.noBgColor]]); }), styleCodes.map(function (k, i) {
        return !k
            ? []
            : [
                // style methods
                [k, i, k === 'bright' || k === 'dim' ? Code.noBrightness : 20 + i],
            ];
    })).reduce(function (a, b) { return a.concat(b); });
})();
/*  ------------------------------------------------------------------------ */
// @ts-ignore
var assignStringWrappingAPI = function (target, wrapBefore) {
    if (wrapBefore === void 0) { wrapBefore = target; }
    return stringWrappingMethods.reduce(function (memo, _a) {
        var _b = tslib_1.__read(_a, 3), k = _b[0], open = _b[1], close = _b[2];
        return O.defineProperty(memo, k, {
            // @ts-ignore
            get: function () { return assignStringWrappingAPI(function (str) { return wrapBefore(wrap(str, open, close)); }); },
        });
    }, target);
};
/*  ------------------------------------------------------------------------ */
var TEXT = 0, BRACKET = 1, CODE = 2;
function rawParse(s) {
    var e_1, _a;
    var state = TEXT, buffer = '', text = '', code = '', codes = [];
    var spans = [];
    for (var i = 0, n = s.length; i < n; i++) {
        var c = s[i];
        buffer += c;
        switch (state) {
            case TEXT: {
                if (c === '\u001b') {
                    state = BRACKET;
                    buffer = c;
                }
                else {
                    text += c;
                }
                break;
            }
            case BRACKET:
                if (c === '[') {
                    state = CODE;
                    code = '';
                    codes = [];
                }
                else {
                    state = TEXT;
                    text += buffer;
                }
                break;
            case CODE:
                if (c >= '0' && c <= '9') {
                    code += c;
                }
                else if (c === ';') {
                    codes.push(new Code(code));
                    code = '';
                }
                else if (c === 'm' && code.length) {
                    codes.push(new Code(code));
                    try {
                        for (var codes_1 = tslib_1.__values(codes), codes_1_1 = codes_1.next(); !codes_1_1.done; codes_1_1 = codes_1.next()) {
                            var code_1 = codes_1_1.value;
                            spans.push({ text: text, code: code_1 });
                            text = '';
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (codes_1_1 && !codes_1_1.done && (_a = codes_1.return)) _a.call(codes_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    state = TEXT;
                }
                else {
                    state = TEXT;
                    text += buffer;
                }
        }
    }
    if (state !== TEXT) {
        text += buffer;
    }
    if (text) {
        spans.push({ text: text, code: new Code() });
    }
    return spans;
}
/*  ------------------------------------------------------------------------ */
/**
 * Represents an ANSI-escaped string.
 */
var Colors = /** @class */ (function () {
    /**
     * @param {string} s a string containing ANSI escape codes.
     */
    function Colors(s) {
        this.spans = s ? rawParse(s) : [];
    }
    Object.defineProperty(Colors.prototype, "str", {
        get: function () {
            return this.spans.reduce(function (str, p) { return str + p.text + p.code.str; }, '');
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Colors.prototype, "parsed", {
        get: function () {
            var styles;
            var brightness;
            var color;
            var bgColor;
            function reset() {
                (color = new Color()),
                    (bgColor = new Color(true /* background */)),
                    (brightness = undefined),
                    (styles = new Set());
            }
            reset();
            return O.assign(new Colors(), {
                spans: this.spans
                    .map(function (span) {
                    var e_2, _a;
                    var c = span.code;
                    var inverted = styles.has('inverse'), underline = styles.has('underline') ? 'text-decoration: underline;' : '', italic = styles.has('italic') ? 'font-style: italic;' : '', bold = brightness === Code.bright ? 'font-weight: bold;' : '';
                    var foreColor = color.defaultBrightness(brightness);
                    var styledSpan = O.assign({ css: bold + italic + underline + foreColor.css(inverted) + bgColor.css(inverted) }, clean({ bold: !!bold, color: foreColor.clean, bgColor: bgColor.clean }), span);
                    try {
                        for (var styles_1 = tslib_1.__values(styles), styles_1_1 = styles_1.next(); !styles_1_1.done; styles_1_1 = styles_1.next()) {
                            var k = styles_1_1.value;
                            styledSpan[k] = true;
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (styles_1_1 && !styles_1_1.done && (_a = styles_1.return)) _a.call(styles_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    if (c.isBrightness) {
                        brightness = c.value;
                    }
                    else if (span.code.value !== undefined) {
                        if (span.code.value === Code.reset) {
                            reset();
                        }
                        else {
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
                    .filter(function (s) { return s.text.length > 0; }),
            });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Colors.prototype, "asChromeConsoleLogArguments", {
        /*  Outputs with Chrome DevTools-compatible format     */
        get: function () {
            var spans = this.parsed.spans;
            return tslib_1.__spread([spans.map(function (s) { return '%c' + s.text; }).join('')], spans.map(function (s) { return s.css; }));
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Colors.prototype, "browserConsoleArguments", {
        get: function () {
            return this.asChromeConsoleLogArguments;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Colors, "nice", {
        /**
         * @desc installs String prototype extensions
         * @example
         * require ('ansicolor').nice
         * console.log ('foo'.bright.red)
         */
        get: function () {
            Colors.names.forEach(function (k) {
                if (!(k in String.prototype)) {
                    O.defineProperty(String.prototype, k, {
                        get: function () {
                            // @ts-ignore
                            return Colors[k](this);
                        },
                    });
                }
            });
            return Colors;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @desc parses a string containing ANSI escape codes
     * @return {Colors} parsed representation.
     */
    Colors.parse = function (s) {
        return new Colors(s).parsed;
    };
    /**
     * @desc strips ANSI codes from a string
     * @param {string} s a string containing ANSI escape codes.
     * @return {string} clean string.
     */
    Colors.strip = function (s) {
        return s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g, ''); // hope V8 caches the regexp
    };
    /**
     * @example
     * const spans = [...ansi.parse ('\u001b[7m\u001b[7mfoo\u001b[7mbar\u001b[27m')]
     */
    Colors.prototype[Symbol.iterator] = function () {
        return this.spans[Symbol.iterator]();
    };
    Colors.names = stringWrappingMethods.map(function (_a) {
        var _b = tslib_1.__read(_a, 1), k = _b[0];
        return k;
    });
    Colors.rgb = {
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
    return Colors;
}());
export default Colors;
/*  ------------------------------------------------------------------------ */
assignStringWrappingAPI(Colors, function (str) { return str; });
//# sourceMappingURL=ansicolor.js.map