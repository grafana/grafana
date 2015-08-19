/*   AdRem Client.js v3.9.4  Ext Direct | Ext Ajax | jQuery Ajax | Chromium | WinJS | NodeJS
 *   2012-2014 Copyright Tomasz Kunicki, AdRem Software, all rights reserved     */

/*
 * Note:
 *		Client uses direct protocol for remote connections for both Ext & Ajax libraries
 *		if embedded connection used requests are sent through remotingProvider however
 *
 *  3.9.4 fix websocket initialization problems
 *  3.9.3 fix startup with require
 *  3.9.2  support for module in NodeJS (HTTP transport)
 adrem = require('client');
 adrem.initClient( 'http://127.0.0.1' );
 *  3.9.11 use zepto.js as jquery replacement
 *  3.9.10 local communication trace
 *  3.9.9  fix re-defining pollEvents (ES6 bug)
 *  3.9.8  fix passing null as single parameter
 *  3.9.7  empty parameters should be empty (undefined)
 *  3.9.6  fix webSocket url with search, EventManager can get array of events
 *  3.9.4  fix webSocket on HTTPS connection
 *  3.9.   fix logout
 *  3.9    Upgrade to WebSocket if possible
 *
 *  3.8.1
 *       added bind implementation for iOS 5
 *
 *  3.8  updated to work WinJS (Windows 8) without jQuery
 *       client.start can now take URL to connect (so can be used in applications like Windows Metro App)
 * 
 *
 *  3.7  object constructors can have handlers like any other methods so you can
 *
 *          myObj = new adrem.App.ObjClass({p:1,p:2}, function() {
 *             console.log( 'Object created' );
 *          }, this);
 *
 *  3.6  methods has new function asURL allowing to create URL for given method
 *       call to
 *
 *          Crm.MyObj.getImage.asURL('apple.png')
 *
 *       returns URL string you can place in style or in image
 *       the URL can look like this:
 *
 *         "data?method=Crm.MyObj$1.getImage&params=%22apple.png%22&sid=36367632"
 *
 *  3.5  allow to add error handler to method call
 *       remoteMethod( params, callback, errorhandler, scope )
 *       if handler returns true value then will stop global exception notification (error handled)
 *
 *  3.4  (break change)
 *              - ability to pass constructor parameter
 *              - object id MUST be passed as a second parameter
 *                update current code and add null as a first parameter
 *
 *  3.3         - Sha-256 digest password authentication added
 *               (this is still less secure than SSL but better than sending clear text passwords)
 *
 *  3.2         - Client events added
 *                  - clientstarted --> after adrem.Client.start
 *                  - login
 *                  - logout
 *  3.1         - support for login/logout --> get api as ajax request
 *  3.0.2       - new client/server session model
 *
 *
 */

/*global define, window, $, console, bitwise:true */

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  Utf8 class: encode / decode between multi-byte Unicode characters and UTF-8 multiple          */
/*              single-byte character encoding (c) Chris Veness 2002-2010                         */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

var Utf8 = {};  // Utf8 namespace

/**
 * Encode multi-byte Unicode string into utf-8 multiple single-byte characters
 * (BMP / basic multilingual plane only)
 *
 * Chars in range U+0080 - U+07FF are encoded in 2 chars, U+0800 - U+FFFF in 3 chars
 *
 * @param {String} strUni Unicode string to be encoded as UTF-8
 * @returns {String} encoded string
 */
Utf8.encode = function (strUni) {
    'use strict';
    // use regular expressions & String.replace callback function for better efficiency
    // than procedural approaches
    var strUtf = strUni.replace(
        /[\u0080-\u07ff]/g, // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
        function (c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xc0 | cc >> 6, 0x80 | cc & 0x3f);
        }
    );
    strUtf = strUtf.replace(
        /[\u0800-\uffff]/g, // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
        function (c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xe0 | cc >> 12, 0x80 | cc >> 6 & 0x3F, 0x80 | cc & 0x3f);
        }
    );
    return strUtf;
};

/**
 * Decode utf-8 encoded string back into multi-byte Unicode characters
 *
 * @param {String} strUtf UTF-8 string to be decoded back to Unicode
 * @returns {String} decoded string
 */
Utf8.decode = function (strUtf) {
    'use strict';
    // note: decode 3-byte chars first as decoded 2-byte strings could appear to be 3-byte char!
    var strUni = strUtf.replace(
        /[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g, // 3-byte chars
        function (c) {  // (note parentheses for precence)
            var cc = ((c.charCodeAt(0) & 0x0f) << 12) | ((c.charCodeAt(1) & 0x3f) << 6) | (c.charCodeAt(2) & 0x3f);
            return String.fromCharCode(cc);
        }
    );
    strUni = strUni.replace(
        /[\u00c0-\u00df][\u0080-\u00bf]/g, // 2-byte chars
        function (c) {  // (note parentheses for precence)
            var cc = (c.charCodeAt(0) & 0x1f) << 6 | c.charCodeAt(1) & 0x3f;
            return String.fromCharCode(cc);
        }
    );
    return strUni;
};


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  SHA-256 implementation in JavaScript | (c) Chris Veness 2002-2010 | www.movable-type.co.uk    */
/*   - see http://csrc.nist.gov/groups/ST/toolkit/secure_hashing.html                             */
/*         http://csrc.nist.gov/groups/ST/toolkit/examples.html                                   */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

var Sha256 = {};  // Sha256 namespace
/**
 * Generates SHA-256 hash of string
 *
 * @param {String} msg                String to be hashed
 * @param {Boolean} [utf8encode=true] Encode msg as UTF-8 before generating hash
 * @returns {String}                  Hash of msg as hex character string
 */
Sha256.hash = function (msg, utf8encode) {
    'use strict';

    // constants [§4.2.2]
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2],
    // initial hash value [§5.3.1]
        H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19],
        W = new Array(64),
        l, N, M, i, j, a, b, c, d, e, f, g, h, t, T1, T2;

    utf8encode = (typeof utf8encode === 'undefined') ? true : utf8encode;

    // convert string to UTF-8, as SHA only deals with byte-streams
    if (utf8encode) msg = Utf8.encode(msg);

    // PREPROCESSING

    msg += String.fromCharCode(0x80);  // add trailing '1' bit (+ 0's padding) to string [§5.1.1]

    // convert string msg into 512-bit/16-integer blocks arrays of ints [§5.2.1]
    l = msg.length / 4 + 2;  // length (in 32-bit integers) of msg + ‘1’ + appended length
    N = Math.ceil(l / 16);   // number of 16-integer-blocks required to hold 'l' ints
    M = new Array(N);

    for (i = 0; i < N; i = i + 1) {
        M[i] = new Array(16);
        for (j = 0; j < 16; j = j + 1) {  // encode 4 chars per integer, big-endian encoding
            M[i][j] = (msg.charCodeAt(i * 64 + j * 4) << 24) | (msg.charCodeAt(i * 64 + j * 4 + 1) << 16) |
            (msg.charCodeAt(i * 64 + j * 4 + 2) << 8) | (msg.charCodeAt(i * 64 + j * 4 + 3));
        } // note running off the end of msg is ok 'cos bitwise ops on NaN return 0
    }
    // add length (in bits) into final pair of 32-bit integers (big-endian) [§5.1.1]
    // note: most significant word would be (len-1)*8 >>> 32, but since JS converts
    // bitwise-op args to 32 bits, we need to simulate this by arithmetic operators
    M[N - 1][14] = ((msg.length - 1) * 8) / Math.pow(2, 32);
    M[N - 1][14] = Math.floor(M[N - 1][14]);
    M[N - 1][15] = ((msg.length - 1) * 8) & 0xffffffff;


    // HASH COMPUTATION [§6.1.2]

    for (i = 0; i < N; i = i + 1) {

        // 1 - prepare message schedule 'W'
        for (t = 0; t < 16; t = t + 1) W[t] = M[i][t];
        for (t = 16; t < 64; t = t + 1) W[t] = (Sha256.sigma1(W[t - 2]) + W[t - 7] + Sha256.sigma0(W[t - 15]) + W[t - 16]) & 0xffffffff;

        // 2 - initialise working variables a, b, c, d, e, f, g, h with previous hash value
        a = H[0];
        b = H[1];
        c = H[2];
        d = H[3];
        e = H[4];
        f = H[5];
        g = H[6];
        h = H[7];

        // 3 - main loop (note 'addition modulo 2^32')
        for (t = 0; t < 64; t = t + 1) {
            T1 = h + Sha256.Sigma1(e) + Sha256.Ch(e, f, g) + K[t] + W[t];
            T2 = Sha256.Sigma0(a) + Sha256.Maj(a, b, c);
            h = g;
            g = f;
            f = e;
            e = (d + T1) & 0xffffffff;
            d = c;
            c = b;
            b = a;
            a = (T1 + T2) & 0xffffffff;
        }
        // 4 - compute the new intermediate hash value (note 'addition modulo 2^32')
        H[0] = (H[0] + a) & 0xffffffff;
        H[1] = (H[1] + b) & 0xffffffff;
        H[2] = (H[2] + c) & 0xffffffff;
        H[3] = (H[3] + d) & 0xffffffff;
        H[4] = (H[4] + e) & 0xffffffff;
        H[5] = (H[5] + f) & 0xffffffff;
        H[6] = (H[6] + g) & 0xffffffff;
        H[7] = (H[7] + h) & 0xffffffff;
    }

    return Sha256.toHexStr(H[0]) + Sha256.toHexStr(H[1]) + Sha256.toHexStr(H[2]) + Sha256.toHexStr(H[3]) +
        Sha256.toHexStr(H[4]) + Sha256.toHexStr(H[5]) + Sha256.toHexStr(H[6]) + Sha256.toHexStr(H[7]);
};

Sha256.ROTR = function (n, x) {
    'use strict';
    return (x >>> n) | (x << (32 - n));
};
Sha256.Sigma0 = function (x) {
    'use strict';
    return Sha256.ROTR(2, x) ^ Sha256.ROTR(13, x) ^ Sha256.ROTR(22, x);
};
Sha256.Sigma1 = function (x) {
    'use strict';
    return Sha256.ROTR(6, x) ^ Sha256.ROTR(11, x) ^ Sha256.ROTR(25, x);
};
Sha256.sigma0 = function (x) {
    'use strict';
    return Sha256.ROTR(7, x) ^ Sha256.ROTR(18, x) ^ (x >>> 3);
};
Sha256.sigma1 = function (x) {
    'use strict';
    return Sha256.ROTR(17, x) ^ Sha256.ROTR(19, x) ^ (x >>> 10);
};
Sha256.Ch = function (x, y, z) {
    'use strict';
    return (x & y) ^ (~x & z);
};
Sha256.Maj = function (x, y, z) {
    'use strict';
    return (x & y) ^ (x & z) ^ (y & z);
};

//
// hexadecimal representation of a number
//   (note toString(16) is implementation-dependant, and
//   in IE returns signed numbers when used on full words)
//
Sha256.toHexStr = function (n) {
    'use strict';
    var
        s = "", v, i;
    for (i = 7; i >= 0; i = i - 1) {
        v = (n >>> (i * 4)) & 0xf;
        s += v.toString(16);
    }
    return s;
};


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/*

 AdRem Client

 */

(function (global, factory) {
    'use strict';
    var url;

    if (typeof define === "function" && define.amd) {
        url = global.unescape(global.location.pathname);
        define("client", ["jquery"], function (jQuery) {
            return factory(global, jQuery, url, false);
        });
    } else {
        if (global.location !== undefined) {
            url = global.unescape(global.location.pathname);
        } else {
            url = '';
        }
        return factory(global, global.jQuery, url, global.global !== undefined);
    }
}(typeof window === 'undefined' ? global : window, function (global, jQuery, locationUrl, isNodeJS) {
    'use strict';

    var adrem = global.adrem || {}, $ = jQuery, httpRequest, httpURL;

    adrem.isEmbedded = (global.__SendRequest !== undefined) && (typeof global.__SendRequest === 'function');
    adrem.isExt = (global.Ext !== undefined);
    // adrem.isExtDirect = (adrem.isExt && (global.Ext.direct !== undefined));
    // -- now we ignore ExtDirect because of compatibility - always use our services
    adrem.isExtDirect = false;
    adrem.isNodeJS = isNodeJS;
    adrem.isJQuery = (global.jQuery !== undefined) || ($ !== undefined && $.zepto !== undefined);
    adrem.isWinJS = (global.WinJS !== undefined);

    adrem.pageUrl = locationUrl;
    adrem.useWebSockets = !adrem.isEmbedded && (global['WebSocket'] != null);
    adrem.traceLocaRequest = false;

    if (isNodeJS) {
        // use superagent for AJAX calls
        httpRequest = require('request');
        httpURL = require('url');
    }

    function isArgumentsAsObject(arg) {
        return ((typeof arg === 'object') && ((typeof arg.params === 'object') || (typeof arg.callback === 'function')));
    }

    function isArray(obj) {
        return obj.constructor === Array;
    }

    function toJSON(obj) {
        return adrem.isExt ? ((global.Ext.JSON !== undefined) ? global.Ext.JSON.encode(obj) : global.Ext.util.JSON.encode(obj)) : JSON.stringify(obj);
    }

    function fromJSON(s) {
        return adrem.isExt ? ((global.Ext.JSON !== undefined) ? global.Ext.JSON.decode(s) : global.Ext.util.JSON.decode(s)) : JSON.parse(s);
    }

    function isPlainObject(obj) {
        // Must be an Object.
        // Because of IE, we also have to check the presence of the constructor property.
        // Make sure that DOM nodes and window objects don't pass through, as well
        if (!obj || typeof obj !== "object" || obj.nodeType) {
            return false;
        }

        try {
            // Not own constructor property must be Object
            if (obj.constructor && !Object.prototype.hasOwnProperty.call(obj, "constructor") && !Object.prototype.hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf")) {
                return false;
            }
        } catch (e) {
            // IE8,9 Will throw exceptions on certain host objects #9897
            return false;
        }

        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.

        var key;
        for (key in obj) {
        }

        return key === undefined || Object.prototype.hasOwnProperty.call(obj, key);
    }

    /*
     * add bind for iOS 5
     *
     */
    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                fToBind = this,
                fNOP = function () {
                },
                fBound = function () {
                    return fToBind.apply(this instanceof fNOP && oThis
                            ? this
                            : oThis,
                        aArgs.concat(Array.prototype.slice.call(arguments)));
                };

            fNOP.prototype = this.prototype;
            fBound.prototype = new fNOP();

            return fBound;
        };
    }

    adrem.extend = function () {
        var options, name, src, copy, copyIsArray, clone,
            target = arguments[0] || {},
            i = 1,
            length = arguments.length,
            deep = false;

        // Handle a deep copy situation
        if (typeof target === "boolean") {
            deep = target;
            target = arguments[1] || {};
            // skip the boolean and the target
            i = 2;
        }

        // Handle case when target is a string or something (possible in deep copy)
        if (typeof target !== "object" && typeof target !== "function") {
            target = {};
        }

        // extend jQuery itself if only one argument is passed
        if (length === i) {
            target = this;
            --i;
        }

        for (; i < length; i++) {
            // Only deal with non-null/undefined values
            if ((options = arguments[i]) != null) {
                // Extend the base object
                for (name in options) {
                    src = target[name];
                    copy = options[name];

                    // Prevent never-ending loop
                    if (target === copy) {
                        continue;
                    }

                    // Recurse if we're merging plain objects or arrays
                    if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
                        if (copyIsArray) {
                            copyIsArray = false;
                            clone = src && isArray(src) ? src : [];

                        } else {
                            clone = src && isPlainObject(src) ? src : {};
                        }

                        // Never move original objects, clone them
                        target[name] = adrem.extend(deep, clone, copy);

                        // Don't bring in undefined values
                    } else if (copy !== undefined) {
                        target[name] = copy;
                    }
                }
            }
        }

        // Return the modified object
        return target;
    };

    function findObj(namespace, acfg) {
        var cfg = acfg || {}, path = namespace.split('.'), i, obj = global, prop;

        for (i = 0; i < path.length; i += 1) {
            prop = path[i];
            if (obj[prop] === undefined) {
                obj[prop] = (i < path.length - 1) ? {} : cfg;
            }
            obj = obj[prop];
        }
        return obj;
    }


    function embeddedRequestHandler(request, handler) {

        if (adrem.traceLocaRequest) {
            console.group('--> Request ' + request.url);
            console.log(request);
            console.groupEnd();
        }
        global.__SendRequest(request.url, request.intf, request.method, toJSON(request.data), function (status, response) {
            var data;
            if (adrem.traceLocaRequest) {
                console.group('<-- Response ' + request.url);
                data = fromJSON(response);
                if (isArray(data)) {
                    console.table(data);
                } else {
                    console.log(data);
                }
                console.groupEnd();
            }
            handler({responseText: response}, status);
        });
    }

    function ajaxRequestHandler(request, callback) {
        var url = adrem.Client.urlPrefix + request.url, rq, qstr,
            method = (request.method !== undefined) ? (request.intf + '.' + request.method) : undefined,
            sid = ((adrem.Client.sid === '') || (adrem.Client.sid === undefined)) ? '' : 'sid=' + adrem.Client.sid;

        if (request.url.indexOf('?') === -1) {
            sid = '?' + sid;
        } else {
            sid = '&' + sid;
        }

        function winJSRequest() {
            if (request.url.length > 0 && request.url[0] === '/') {
                if (adrem.Client.urlPrefix.length > 0 && adrem.Client.urlPrefix[adrem.Client.urlPrefix.length - 1] === '/') {
                    url = adrem.Client.urlPrefix + request.url.slice(1, request.url.length);
                }
            }
            WinJS.Promise.timeout(request.timeout || 15 * 1000, WinJS.xhr({
                url: url + sid + ((method !== undefined) ? '&method=' + method : ''),
                type: ((request.data === undefined) || (request.data === null)) ? 'GET' : 'POST',
                headers: {"Content-Type": "application/json"},
                data: toJSON(request.data)
            }).then(
                function success(response) {
                    callback(response, true);
                },
                function failure(response) {
                    if (response.status === 449) {
                        global.location.href = adrem.pageUrl;
                    }
                    callback(response, false);
                }
            ));
        }

        function extRequest() {
            global.Ext.Ajax.request({
                url: request.url + sid,
                method: (request.data === null) ? 'GET' : 'POST',
                params: {
                    method: method
                },
                timeout: request.timeout || 15 * 1000,
                jsonData: request.data,
                success: function (response) {
                    callback(response, true);
                },
                failure: function (response) {
                    if (response.status === 449) {
                        global.location.href = adrem.pageUrl;
                    }
                    callback(response, true);
                }
            });
        }

        function jQueryRequest() {
            global.$.ajax({
                url: request.url + sid + ((method !== undefined) ? '&method=' + method : ''),
                type: ((request.data === undefined) || (request.data === null)) ? 'GET' : 'POST',
                contentType: "application/json",
                data: toJSON(request.data),
                timeout: request.timeout || 15 * 1000,
                cache: false,
                complete: function (response, success) {
                    // refresh page if session expired
                    if ((success === 'error') && (response.status === 449)) {
                        global.location.href = adrem.pageUrl;
                    } else {
                        callback(response, success === 'success');
                    }
                }
            });
        }

        function nodeJSRequest() {
            var path, rparts = request.url.split('?');
            if (request.url[0] !== '/') {
                url = adrem.pageUrl + rparts[0]; // + sid + ((method !== undefined) ? '&method=' + method : '');
            } else {
                // properly format url
                path = httpURL.parse(adrem.pageUrl);
                path.pathname = rparts[0];
                url = httpURL.format(path); // + sid + ((method !== undefined) ? '&method=' + method : '');
            }
            if (sid === '?') {
                sid = undefined;
            } else {
                sid = adrem.Client.sid;
            }
            // encode query string
            qstr = {};
            if (sid !== undefined) {
                qstr.sid = sid;
            }
            if (method !== undefined && method !== '') {
                qstr.method = method;
            }
            if (rparts.length > 1) {
                rparts[1].split('&').forEach(function (p) {
                    var v = p.split('=');
                    qstr[v[0]] = v[1];
                })
            }
            httpRequest(url, {
                method: ((request.data === undefined) || (request.data === null)) ? 'GET' : 'POST',
                timeout: request.timeout || 15 * 1000,
                qs: qstr,
                gzip: true,
                json: request.data
            }, function (err, response, body) {
                if (response.statusCode === 200) {
                    // unfortunately the response can be decoded
                    if (typeof body !== 'string') {
                        body = toJSON(body)
                    }
                    callback({responseText: body}, true);
                } else {
                    callback({}, false);
                }
            });
        }

        if (adrem.isWinJS) {
            winJSRequest();
        } else if (adrem.isExt) {
            extRequest()
        } else if (adrem.isJQuery) {// use jQuery
            jQueryRequest()
        } else if (adrem.isNodeJS) {
            nodeJSRequest();
        } else {
            console.error('No xhr library found');
            throw 'No xhr library found';
        }
    }

    var
        RemoteAPI,

    /*
     * simple ajax & request provider
     * also used for embedded calls
     *
     */
        AdremRemotingProvider = function (requestHandler) {
            var requests = [];

            function getRequest() {
                if ((requests.length > 0) && (!requests.pending)) {
                    return requests.shift();
                } else {
                    return null;
                }
            }


            function handleRequest(request) {
                if (request !== null) {
                    requests.pending = true;
                    requestHandler(request, (function (rq) {
                        return function (response, success) {
                            requests.pending = false;
                            if (requests.length > 0) {
                                handleRequest(getRequest());
                            }
                            rq.callback(rq, response, success);
                        };
                    }(request)));
                }
            }

            this.isProcessing = function () {
                return requests.pending;
            };

            this.request = function (request) {
                request.queue = true;
                if (!adrem.isEmbedded && requests.pending) {
                    requests.push(request);
                } else {
                    handleRequest(request);
                }
            };

            requests.pending = false;
        },


    /*
     * Emulate Ext.Direct protocol by grouping multiple requests and sending
     * to server in single Ajax request
     */
        AdremDirectProvider = function (requestHandler, retentionTime) {
            var tid = 1, aTime = retentionTime || 25, me = this, requests = [], pending = false;

            function scheduleTasks(atask) {
                if (requests.length > 0) {
                    global.setTimeout(atask, aTime);
                }
            }

            function processRequests() {
                var i, data = [], r;

                if (!pending && requests.length > 0) {
                    for (i = 0; i < requests.length; i += 1) {
                        r = requests[i];
                        r.tid = tid;
                        tid = tid + 1;
                        data[i] = {
                            action: r.intf,
                            method: r.method,
                            data: r.data,
                            type: 'rpc',
                            tid: r.tid
                        };
                    }
                    pending = true;
                    requestHandler({
                        url: requests[0].url,
                        data: data,
                        scope: me
                    }, (function (pendingRequests) {
                        return function (response, success) {
                            var id, i, baseTid, rq, responses;

                            if (success) {
                                baseTid = pendingRequests[0].tid;
                                responses = fromJSON(response.responseText);
                                if (!isArray(responses)) {
                                    responses = [responses];
                                }
                                for (i = 0; i < responses.length; i += 1) {
                                    id = responses[i].tid;
                                    rq = pendingRequests[id - baseTid];
                                    rq.callback(rq, {
                                        response: responses[i]
                                    }, success);
                                }
                            } else {
                                for (i = 0; i < pendingRequests.length; i += 1) {
                                    rq = pendingRequests[i];
                                    rq.callback(rq, {
                                        responseText: response.responseText,
                                        statusText: response.statusText
                                    }, success);
                                }
                            }
                            pending = false;
                            scheduleTasks(processRequests);
                        };
                    }(requests)));
                    requests = [];
                }
                scheduleTasks(processRequests);
            }

            this.request = function (request) {
                requests.push(request);
                scheduleTasks(processRequests);
            };
        },


    /*
     * Remote polling provider for polling events
     *
     */
        AdremPollingProvider = function (api, arequestHandler, eventManager) {
            var requestHandler = arequestHandler,
                me = this,
                pollingTime = api.interval || 50,
                errorPollingTime = 60 * 1000;

            this.dispatchEvents = function (response, success) {
                var reply, i, len;

                if (success && (response.responseText !== "")) {
                    reply = fromJSON(response.responseText);
                    if (isArray(reply)) {
                        for (i = 0, len = reply.length; i < len; i += 1) {
                            if ((reply[i].name !== undefined) && (eventManager.hasListener(reply[i].name.toLowerCase()))) {
                                eventManager.fireEvent(reply[i].name.toLowerCase(), reply[i]);
                            }
                        }
                    } else if ((reply.name !== undefined) && (eventManager.hasListener(reply.name.toLowerCase()))) {
                        eventManager.fireEvent(reply.name.toLowerCase(), reply);
                    }
                    if (!adrem.webSocketsMode()) {
                        global.setTimeout(pollEvents, pollingTime);
                    }
                } else {
                    if (!adrem.webSocketsMode()) {
                        global.setTimeout(pollEvents, errorPollingTime);
                    }
                }
            };

            function pollEvents() {
                requestHandler({
                    url: me.api.url,
                    timeout: me.api.timeout || 60000,
                    scope: me
                }, function (response, success) {
                    me.dispatchEvents(response, success);
                });
            }

            me.api = api;
            if (!adrem.webSocketsMode()) {
                global.setTimeout(pollEvents, pollingTime);
            }
        },

        AdremWebSocketProvider = function (ajaxProvider) {
            var socket, lastTid = 1, pending = {}, url, i;

            this.useWebSocket = function () {
                var wsProtocol = (location.protocol.toUpperCase() === "HTTPS:") ? "wss://" : "ws://";

                if (adrem.useWebSockets) {
                    if ((adrem.Client === undefined) || (adrem.Client.sid === undefined) || (adrem.Client.sid === 0)) {
                        console.log("Can't create websocket - no SID");
                        adrem.socket = undefined;
                        socket = undefined;
                        return false;
                    } else {
                        try {
                            url = locationUrl;
                            i = url.length - 1;

                            while (url[i] !== "/" && i > 0) i--;
                            if (url[i] == '/') {
                                url = url.substr(0, i + 1);
                            }

                            socket = new WebSocket(wsProtocol + global.location.host + url + adrem.Client.sid);

                            socket.onerror = function (ev) {
                                console.log("WebSocket error, falling back to AJAX RPC!");
                                // disable websockets and use AJAX requests
                                adrem.useWebSockets = false;
                                adrem.socket = undefined;
                                socket = undefined;
                            };

                            socket.onclose = function (ev) {
                                // We need to provide some event like connection broken
                                // and UI should reload application
                                adrem.Client.fireEvent('connection-closed');
                                socket = undefined;
                            };

                            socket.onmessage = function (ev) {
                                var msgparts = ev.data.split("\x01"), prefix, data, response, request;

                                prefix = msgparts[0];
                                data = msgparts[1];

                                if (prefix === 'e') {
                                    adrem.api.events.provider.dispatchEvents({responseText: data}, true);
                                } else if (prefix === 'r') {
                                    response = fromJSON(data);
                                    request = pending[response.tid];
                                    delete pending[response.tid];

                                    request.callback(request, {'response': response}, true);
                                } else {
                                    console.log('Invalid message prefix');
                                    socket.close();
                                    socket = undefined;
                                    adrem.Client.fireEvent('connection-closed');
                                }
                            };
                            return true;
                        } catch (e) {
                            // disable websockets and use AJAX requests
                            console.log('Error opening websocket ', e);
                            adrem.useWebSockets = false;
                            adrem.socket = undefined;
                            socket = undefined;
                            return false;
                        }
                    }
                }
                return adrem.useWebSockets;
            };

            adrem.webSocketsMode = function () {
                return adrem.useWebSockets && (socket !== undefined) && (socket.readyState === socket.OPEN);
            };

            this.request = function (request) {
                var api = request.url.split('=')[1], rq;

                if (adrem.webSocketsMode()) {
                    // extract API from request
                    lastTid += 1;
                    pending[lastTid] = request;
                    rq = {
                        dat: request.data,
                        call: request.intf + '.' + request.method,
                        tid: lastTid
                    };
                    socket.send(api + '\x01' + toJSON(rq));
                } else {
                    ajaxProvider.request(request);
                }
            };
        },

    /*
     *  Delegate event handling to Ext.direct event manager
     */
        ExtDirectEventManager = function () {
            this.fireEvent = function () {
                return global.Ext.direct.Manager.fireEvent.apply(global.Ext.Direct, Array.prototype.slice.call(arguments, 0));
            };
            this.on = function (eventId, fn, scope, opt) {
                return global.Ext.direct.Manager.on(eventId, fn, scope, opt);
            };
            this.un = function (eventId, fn, scope, opt) {
                return global.Ext.direct.Manager.un(eventId, fn, scope, opt);
            };
            this.hasListener = function (eventId) {
                return global.Ext.direct.Manager.hasListener(eventId);
            };
        },

    /*
     *  Simple event manager
     */
        EventManager = function () {
            var events = {};

            this.fireEvent = function (eventId) {
                var args = Array.prototype.slice.call(arguments, 1);

                eventId = eventId.toLowerCase();
                if (events.hasOwnProperty(eventId)) {
                    events[eventId].forEach(function (listener) {
                        listener.fn.apply(listener.scope, args);
                    }, this);
                }
            };

            this.on = function (eventId, fn, scope) {
                //console.log('on:', eventId);
                if (isArray(eventId)) {
                    eventId.forEach(function (e) {
                        this.on(e, fn, scope);
                    }, this);
                } else {
                    eventId = eventId.toLowerCase();

                    if (events[eventId] === undefined) {
                        events[eventId] = [];
                    }
                    events[eventId].push({
                        fn: fn,
                        scope: scope
                    });
                }
            };

            this.un = function (eventId, fn, scope) {
                //console.log('un:', eventId);
                var listeners, i;
                if (isArray(eventId)) {
                    eventId.forEach(function (e) {
                        this.un(e, fn, scope);
                    }, this);
                } else {
                    eventId = eventId.toLowerCase();
                    if (events[eventId]) {
                        listeners = events[eventId];
                        for (i = listeners.length - 1; i >= 0; i -= 1) {
                            if ((listeners[i].fn === fn) && (listeners[i].scope === scope)) {
                                events[eventId].splice(i, 1);
                            }
                        }
                    }
                }
            };

            this.hasListener = function (eventId) {
                return (events !== undefined) && (events[eventId] && events[eventId].length > 0);
            };
        },

    /*
     *  Remote Client Prototype
     *  manages remote objects and creates remote api calls
     */
        RemoteClient = function (hostAddr, applicationId) {
            var _asyncId = 1, that = this, remoteProvider, appId = "", tokenId;


            RemoteClient.inherited.constructor.apply(this); // call inherited
            this.status = {logged: false};

            /*
             *  remove remote object
             *  call server destroy method to finalize remote object
             *
             */
            function removeRemoteObject(obj) {
                var id = obj.id.split('.')[1], owner = findObj(obj.namespace);

                if (owner[id] !== undefined) {
                    obj['@destroy']();
                    if (adrem.isExtDirect) {
                        global.Ext.direct.Manager.removeProvider(id);
                    }
                    delete owner[id];
                }
            }

            /*
             *  Create remote object stub
             *
             */
            function createRemoteObject(apiObj, actionName, instanceId) {
                var cfg = {
                        namespace: apiObj.namespace + '.' + actionName + '.__inst__.' + instanceId,
                        type: apiObj.type,
                        url: apiObj.url,
                        id: actionName + '$' + instanceId,
                        actions: {},
                        api: apiObj
                    }, instanceName = cfg.id, //actionName + '$' + instanceId,
                    instance = {};

                cfg.actions[instanceName] = apiObj.actions[actionName];
                adrem.Client.addAPI(cfg);
                instance = findObj(cfg.namespace)[instanceName];
                instance.id = apiObj.name + '.' + cfg.id;
                instance.namespace = cfg.namespace;
                instance.destroy = function () {
                    removeRemoteObject(this);
                };
                return instance;
            }

            /*
             * Make remote function constructors of additional instances
             * setup asyncCall function of each function
             */

            function asURL(objAPI, method) {
                var params = Array.prototype.slice.call(arguments, 2);
                return (objAPI.dataUrl + '?method=' + objAPI.name + '.' + method.action + '.' + method.method +
                '&params=' + encodeURIComponent(toJSON(params)) +
                '&sid=' + adrem.Client.sid
                );
            }

            function asTask(objAPI, method, params) {
                var request = new (findObj(objAPI.namespace)).IObjAsyncCallTask(),
                    args,
                    updateTime,
                    callback,
                    scope,
                    fn,

                    checkStatus = function () {
                        request.finished = false;
                        request.GetStatus(function (result) {
                            var p;

                            for (p in result) {
                                if (result.hasOwnProperty(p)) {
                                    request[p] = result[p];
                                }
                            }

                            if (request.finished) {
                                // sent finished event
                                adrem.Client.fireEvent(request.id, {
                                    eventid: 0,
                                    data: request.reply
                                }, request);
                            } else {
                                request.callback.call(request.scope, request);
                                request.progressTask = global.setTimeout(checkStatus, updateTime);
                            }
                        }, request);
                    };

                if (isArgumentsAsObject(params)) {
                    args = params.params;
                    updateTime = params.updateTime;
                    callback = params.callback;
                    scope = params.scope;
                } else { // multiple arguments
                    args = Array.prototype.slice.call(arguments, 2, 2 + method.len);
                    updateTime = arguments[method.len + 2];
                    callback = arguments[method.len + 3];
                    scope = arguments[method.len + 4];
                }

                request.Call(method.action, method.method, args, scope);
                request.callback = callback;
                request.scope = scope !== undefined ? scope : request;
                request.destroy = function () {
                    adrem.Client.fireEvent(request.id, {
                        eventid: 0
                    }, request);
                };

                // Notify upon termination
                adrem.Client.on(request.id, fn = function (e) {
                    if (request.progressTask !== undefined) {
                        global.clearTimeout(request.progressTask);
                    }
                    if (request.callback !== undefined) {
                        request.finished = true;
                        request.reply = e.data;
                        request.callback.call(request.scope, request);
                    }
                    adrem.Client.un(request.id, fn);
                    request['@destroy']();
                });

                // Start Update Task
                if ((updateTime > 0) && (callback !== undefined)) {
                    request.progressTask = global.setTimeout(checkStatus, updateTime);
                }
                return request;
            }

            function bindClientCalls(me, api) {
                var i, len, actions = api.actions, intf, new_cls, fn, ms, m, cls, aapi;

                function globalEventsEventId(id) {
                    return api.name + '#' + id.toString(16);
                }

                function NewObject(intface, initParam) {
                    var obj, ix, objId;

                    initParam = initParam || null;

                    if (arguments[2] === undefined || typeof arguments[2] === 'function' || typeof arguments[2] === 'object') {
                        objId = _asyncId;
                        _asyncId += 1;
                        ix = 2;
                    } else {
                        ix = 3;
                        objId = arguments[2];
                    }

                    obj = createRemoteObject.call(me, api, intface, objId);
                    if (initParam !== null) {
                        if (arguments.length > ix) {
                            obj['@create'].apply(this, Array.prototype.concat(initParam, Array.prototype.slice.call(arguments, ix)));
                        } else {
                            obj['@create'](initParam);
                        }
                    }
                    return obj;
                }

                for (intf in actions) {
                    if (actions.hasOwnProperty(intf)) {
                        cls = findObj(api.namespace + '.' + intf);

                        // do not allow instantiation of predefined interfaces IGlobalEvents, IClientServices
                        if (intf === 'IGlobalEvents') {
                            cls.eventId = globalEventsEventId;
                        } else if ((intf !== 'IClientServices') && (intf !== 'Security')) {
                            //TODO: remove hardcoded interfaces --> add attribute in api description
                            if (cls.id === undefined) {// Ext.Direct does not create id's for objects
                                cls.id = api.name + '.' + intf;
                            }

                            if (cls.id.indexOf('$') < 0) {
                                // create constructors for new objects
                                new_cls = NewObject.bind(this, intf);

                                // copy methods to the new constructor
                                ms = actions[intf];
                                for (i = 0, len = ms.length; i < len; i += 1) {
                                    m = ms[i];
                                    new_cls[m.name] = cls[m.name];
                                }

                                // finally replace old object with the new constructor
                                new_cls.id = cls.id;
                                //this.namespace[c] = new_cls;
                                findObj(api.namespace)[intf] = new_cls;
                                cls = new_cls;
                            }

                            // setup async calls
                            ms = actions[intf];
                            aapi = (api.api !== undefined) ? api.api : api; // api here must be original class api instead of instance api obj
                            for (i = 0, len = ms.length; i < len; i += 1) {
                                fn = cls[ms[i].name];
                                fn.asTask = asTask.bind(cls, aapi, fn);
                                fn.asURL = asURL.bind(cls, aapi, fn);
                            }
                        }
                    }
                }
                return api;
            }

            function fixExtPolling(apiDef) {
                apiDef.on('beforepoll', function (provider) {
                    return apiDef.state !== 1;
                });

                global.Ext.Ajax.on('beforerequest', function (conn, opt) {
                    if (opt.url === apiDef.url) {
                        apiDef.state = 1;
                    }
                });

                global.Ext.Ajax.on('requestcomplete', function (conn, resp, opt) {
                    if (opt.url === apiDef.url) {
                        apiDef.state = 0;
                    }
                });

                global.Ext.Ajax.on('requestexception', function (conn, resp, opt) {
                    if (opt.url === apiDef.url) {
                        apiDef.state = 0;
                    }
                });
            }

            function getRequestHandler() {
                return adrem.isEmbedded ? embeddedRequestHandler : ajaxRequestHandler;
            }

            if (!adrem.isExtDirect || adrem.isEmbedded) {
                if (!adrem.isEmbedded) {
                    remoteProvider = new AdremDirectProvider(getRequestHandler());
                } else {
                    remoteProvider = new AdremRemotingProvider(getRequestHandler());
                }
                remoteProvider = new AdremWebSocketProvider(remoteProvider);
            }

            // Create application id used as prefix for storages
            appId = applicationId || 'app';
            if (appId.split('.')[1] !== undefined) {
                appId = '';
            } else {
                appId = ':' + appId;
            }
            appId = hostAddr + appId;
            tokenId = 'tid:' + appId;

            /*
             * Start Application
             *
             */
            this.start = function (/*urlPrefix, callback, ascope*/) {
                var ix = 0, urlParts, scope, callback,
                    requestHandler = getRequestHandler(),
                    sidItem = 'sid:' + appId;

                function doNotify(status) {
                    if (callback !== undefined) {
                        callback.call(scope, status);
                    }
                    adrem.Client.status = status;

                    // switching provider
                    if (adrem.useWebSockets) {
                        remoteProvider.useWebSocket();
                    }

                    adrem.Client.fireEvent('clientstarted', status);
                    if (status.logged) {
                        adrem.Client.fireEvent('login', status);
                    }
                }

                this.urlPrefix = '';
                this.appPrefix = '';

                function splitURL(url) {
                    var appParts = url.split('/'), urlParts = appParts.splice(0, 3);
                    return {
                        urlPrefix: urlParts.join('/') + '/',
                        appPrefix: appParts.join('/')
                    }
                }

                if (arguments.length > 0) {
                    if (typeof arguments[ix] === 'string') {
                        urlParts = splitURL(arguments[ix]);
                        this.urlPrefix = urlParts.urlPrefix;
                        this.appPrefix = urlParts.appPrefix;
                        ix += 1;
                    }
                    if (ix < arguments.length && typeof arguments[ix] === 'function') {
                        callback = arguments[ix];
                        ix += 1;

                        if (ix < arguments.length && typeof arguments[ix] === 'object') {
                            scope = arguments[ix];
                        }
                    }
                } else {
                    scope = global;
                }

                // if we have session id
                if (global.sessionStorage !== undefined) {
                    that.sid = global.sessionStorage.getItem(sidItem);
                    if (that.sid === null) {
                        delete that.sid;
                    }
                }

                // Get API
                requestHandler({
                    url: this.appPrefix + 'api.json'
                }, function (response, success) {
                    var aToken, i, data;

                    if (success) {
                        data = fromJSON(response.responseText);
                        // create all apis
                        for (i = 0; i < data.api.length; i += 1) {
                            that.addAPI(data.api[i]);
                        }

                        // add session id
                        that.sid = data.sid;
                        that.authentication = data.authentication;
                        that.loggedIn = false;

                        if (global.sessionStorage !== undefined) {
                            global.sessionStorage.setItem(sidItem, that.sid);
                        }

                        if ('Session' in adrem.Client) {
                            aToken = global.localStorage !== undefined ? global.localStorage.getItem(tokenId) : undefined;
                            if ((aToken !== undefined) && (aToken !== null)) {
                                adrem.Client.Session.Security.Authenticate(aToken, function (result) {
                                    if (!result.Success) {
                                        global.localStorage.removeItem(tokenId);
                                    } else {
                                        global.localStorage.setItem(tokenId, result.Token);
                                    }
                                    that.loggedIn = result.Success;
                                    doNotify({logged: result.Success, init: true});
                                });
                            } else {
                                doNotify({logged: false, init: true}); // Not logged in but successfully init
                            }
                        } else {
                            that.loggedIn = true;
                            doNotify({logged: true, init: true}); // Logged in or no login necessary
                        }
                    } else {
                        doNotify({logged: false, init: false}); // not logged and not initialized properly
                    }
                });
                return false;
            };

            /*
             *
             *  Logout
             *
             */
            this.logout = function (callback, scope) {
                if ('Session' in adrem.Client) {
                    adrem.Client.Session.Security.Logout(function () {
                        global.localStorage.removeItem(tokenId);
                        if (callback !== undefined) {
                            callback.call(scope);
                        }
                        adrem.Client.fireEvent('logout');
                    });
                } else {
                    throw new Error('No login support');
                }
            };

            /*
             * Login
             *
             */

            this.login = function (aName, aPassword, callback, scope) {

                function getPasswd(pass) {
                    if (adrem.Client.authentication === 'plain') {
                        return pass;
                    } else {
                        return Sha256.hash(Sha256.hash(aName) + ':' + Sha256.hash(adrem.Client.sid.toString()) + ':' + Sha256.hash(pass));
                    }
                }

                if ('Session' in adrem.Client) {
                    adrem.Client.Session.Security.Login(aName, getPasswd(aPassword), function (result) {
                        if (result.Success) {
                            if (global.localStorage !== undefined) {
                                global.localStorage.setItem(tokenId, result.Token);
                            }
                            adrem.Client.loggedIn = true;
                        }
                        if (typeof callback == 'function') {
                            callback.call(scope, result.Success);
                        }
                        adrem.Client.fireEvent('login', {logged: result.Success, init: true});
                    });
                } else {
                    throw new Error('No login support');
                }
            };

            /*
             *  addAPI
             *
             */
            this.addAPI = function (api) {
                var apiDef;

                if (api.api === undefined) {
                    if (adrem.api === undefined) {
                        adrem.api = {};
                    }
                    // skip double initialization
                    if (adrem.api[api.name] !== undefined) {
                        return;
                    }
                    adrem.api[api.name] = api;
                    if (api.namespace !== undefined) {
                        findObj(api.namespace);
                    }
                }

                if (!adrem.isEmbedded && adrem.isExtDirect) {
                    apiDef = global.Ext.direct.Manager.addProvider(api);
                    //? Why we need to fix that polling ?
                    if (api.type === 'polling') {
                        fixExtPolling(apiDef);
                    }
                } else {

                    if (api.type === 'remoting') {
                        api.provider = remoteProvider;
                        apiDef = new RemoteAPI(api);
                    } else if (api.type === 'polling') {
                        api.provider = new AdremPollingProvider(api, getRequestHandler(), that);
                    }
                }
                if (api.type === 'remoting') {
                    bindClientCalls(apiDef, api);
                }
                return apiDef;
            };
        };

    RemoteAPI = function (api) {
        var o = api.actions, c, cls, m, ms, fn, i, len;

        this.url = api.url;
        this.namespace = global[api.namespace];

        function handleRemoteResponse(request, result, success) {
            var reply, ev, method = request.intf + '.' + request.method,
                callback = request.handler, errorHandler = request.errorHandler, scope = request.scope;

            function handledByCaller(param) {
                return (request.errorHandler !== undefined) &&
                    (request.errorHandler(reply.result) === true); // return true to not pass event to global handler
            }

            if (success && result && ((result.response !== undefined) || (result.responseText !== ""))) {
                reply = (result.response !== undefined) ? result.response : fromJSON(result.responseText);
                if (reply.type === 'exception') {
                    if (!handledByCaller(reply.result)) {
                        ev = reply.result;
                        ev.method = method;
                        adrem.Client.fireEvent('exception', ev);
                    }
                    return;
                }
            } else if (success) {
                reply = {
                    result: {
                        success: false
                    }
                };
            }
            if (!success) {
                ev = {
                    classname: 'xhr',
                    method: method,
                    message: "error calling: " + method
                };
                if (!handledByCaller(ev)) {
                    adrem.Client.fireEvent('exception', ev);
                }
            } else if ((callback !== undefined) && (callback.call !== undefined)) {
                if (typeof callback === 'function') {
                    callback.call(scope, reply.result);
                }
            }
        }

        function remoteCall(url, intf, method, args) {
            var data, handler, errorHandler, scope, ix;

            if (args[0] !== null && isArgumentsAsObject(args[0])) {
                data = args[0].params;
                handler = args[0].callback;
                scope = args[0].scope;
                errorHandler = args[0].errorHandler;
            } else {// multiple arguments
                data = null;
                ix = method.len;

                // No parameters means no parameters
                if (ix === 0) {
                    data = undefined;
                }
                handler = args[ix];
                ix += 1;
                if (args[ix] !== undefined && typeof args[ix] === 'function') {
                    errorHandler = args[ix];
                    ix += 1;
                }
                scope = args[ix];
                if (method.len !== 0) {
                    data = args.slice(0, method.len);
                }
            }

            if (handler !== undefined && handler.call === undefined) {
                throw new Error('Invalid parameters passed');
            }

            api.provider.request({
                url: url,
                intf: intf,
                method: method.name,
                data: data,
                handler: handler,
                errorHandler: errorHandler,
                scope: scope,
                callback: handleRemoteResponse
            }, true);
        }


        function createMethod(ascope, classId, methodName) {
            return function () {
                remoteCall(this.url, classId, methodName, Array.prototype.slice.call(arguments, 0));
            }.bind(ascope);
        }

        for (c in o) {
            if (o.hasOwnProperty(c)) {

                cls = findObj(api.namespace + '.' + c);
                cls.id = api.name + '.' + c;
                ms = o[c];
                for (i = 0, len = ms.length; i < len; i += 1) {
                    m = ms[i];
                    fn = createMethod(this, c, m);
                    fn.action = c;
                    fn.len = m.len;
                    fn.method = m.name;
                    cls[m.name] = fn;
                }
            }
        }
    };

    adrem.inherit = (function () {
        var F = function () {
        };
        return function (C, P) {
            F.prototype = P.prototype;
            C.prototype = new F();
            C.inherited = P.prototype;
            C.prototype.constructor = C;
        };
    }());

    adrem.EventManager = (!adrem.isEmbedded && adrem.isExtDirect) ? ExtDirectEventManager : EventManager;
    adrem.inherit(RemoteClient, adrem.EventManager);

    adrem.initClient = function (aHost, aAppId) {
        adrem.pageUrl = aHost;
        adrem.Client = new RemoteClient(aHost, aAppId);
        adrem.Client.isEmbedded = adrem.isEmbedded;
        adrem.Client.sid = '';
        return adrem;
    };


    if (!isNodeJS) {
        adrem.initClient(location.host, location.pathname.split('/')[1]);
    } else {
        if (typeof module === 'object') {
            module.exports.adrem = adrem;
        }
    }

    if (adrem.isEmbedded) {
        adrem.DispatchRequest = function (obj, result) {
            obj.callback(obj, true, result);
        };
    }

    global.adrem = adrem;
    return adrem;
}));