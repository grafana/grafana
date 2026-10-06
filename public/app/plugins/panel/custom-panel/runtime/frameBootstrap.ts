import {
  MAX_DIAGNOSTIC_LENGTH,
  MAX_DOM_NODES,
  MAX_HEIGHT_HINT_PX,
  MAX_HREF_LENGTH,
  RENDER_INIT_MESSAGE_TYPE,
  RENDER_PROTOCOL_VERSION,
} from './constants';

/**
 * Scripts that run inside the sandboxed frames. They are kept as plain ES2019 strings, not
 * functions serialized with Function.toString, because transpiled functions can reference
 * helpers that do not exist in the frame. They must never contain a closing script tag or an
 * HTML comment opener, because document.ts places them verbatim inside a script element.
 *
 * Placeholders are replaced by document.ts with JSON string literals whose '<' is escaped.
 */
export const BOOTSTRAP_NONCE_PLACEHOLDER = '__RENDER_NONCE__';
export const BOOTSTRAP_CODE_PLACEHOLDER = '__RENDER_CODE__';
export const BOOTSTRAP_CONTENT_PLACEHOLDER = '__RENDER_CONTENT_DOCUMENT__';

const INIT_TYPE = JSON.stringify(RENDER_INIT_MESSAGE_TYPE);

/**
 * Runs in the wrapper document. It owns navigation containment: its frame-src 'none' blocks the
 * content frame from navigating away, and a second content load removes the content frame. It
 * forwards the init message and its port to the content frame exactly once.
 */
export const WRAPPER_BOOTSTRAP_SOURCE = `(function () {
  'use strict';
  var CONTENT = ${BOOTSTRAP_CONTENT_PLACEHOLDER};
  var INIT_TYPE = ${INIT_TYPE};
  var VERSION = ${RENDER_PROTOCOL_VERSION};
  var child = document.createElement('iframe');
  child.setAttribute('sandbox', 'allow-scripts');
  child.style.cssText = 'border:0;width:100%;height:100%;display:block';
  var loaded = false;
  var accepted = false;
  var pending = null;
  function forward() {
    if (!loaded || !pending || !child.contentWindow) {
      return;
    }
    child.contentWindow.postMessage(pending.data, '*', pending.ports);
    pending = null;
  }
  child.addEventListener('load', function () {
    if (loaded) {
      child.remove();
      return;
    }
    loaded = true;
    forward();
  });
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (accepted || event.source !== window.parent || !data || typeof data !== 'object' ||
        data.type !== INIT_TYPE || data.version !== VERSION || !event.ports || event.ports.length !== 1) {
      return;
    }
    accepted = true;
    pending = { data: { type: INIT_TYPE, version: VERSION }, ports: [event.ports[0]] };
    forward();
  });
  child.srcdoc = CONTENT;
  document.body.appendChild(child);
})();`;

/**
 * Runs in the content document before the user code. It installs the global panel API, buffers
 * errors until the host connects, coalesces draws per animation frame and reports back on the port.
 */
export const CONTENT_BOOTSTRAP_SOURCE = `(function () {
  'use strict';
  // Captured first: the user code must never find this element, its nonce or its text.
  var bootstrapScript = document.currentScript;
  var NONCE = ${BOOTSTRAP_NONCE_PLACEHOLDER};
  var CODE = ${BOOTSTRAP_CODE_PLACEHOLDER};
  var INIT_TYPE = ${INIT_TYPE};
  var VERSION = ${RENDER_PROTOCOL_VERSION};
  var MAX_DIAGNOSTIC_LENGTH = ${MAX_DIAGNOSTIC_LENGTH};
  var MAX_DOM_NODES = ${MAX_DOM_NODES};
  var MAX_HEIGHT = ${MAX_HEIGHT_HINT_PX};
  var MAX_HREF_LENGTH = ${MAX_HREF_LENGTH};
  var MAX_BUFFERED_ERRORS = 20;
  var RESIZE_OBSERVER_LOOP = 'ResizeObserver loop';
  var XLINK = 'http://www.w3.org/1999/xlink';
  var DEFAULT_TIME_FORMAT = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  hardenRealm();

  var root = document.getElementById('root');
  var port = null;
  var buffered = [];
  var draw = null;
  var runningUserCode = false;
  var startupFailed = false;
  var paused = false;
  var pending = null;
  var lastInput = null;
  var scheduled = false;
  var drawing = false;
  var lastHeight = -1;
  var heightScheduled = false;
  var themeKey = '';
  var paletteCount = 0;

  /*
   * CSP does not govern WebRTC, so the constructors are replaced before the user code runs. A
   * nested frame would hand the code a fresh realm with the original constructors, so frame-like
   * elements cannot be created, inserted or parsed from markup, and their windows are never
   * exposed. Every check uses references captured here, so the code cannot neutralize it by
   * replacing globals or prototype methods later.
   */
  function hardenRealm() {
    var reflectApply = Reflect.apply;
    var defineProperty = Object.defineProperty;
    var getOwnDescriptor = Object.getOwnPropertyDescriptor;
    var SafeError = Error;
    var regexpExec = RegExp.prototype.exec;
    var FRAME_TAGS = Object.create(null);
    var frameTagNames = ['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe'];
    for (var t = 0; t < frameTagNames.length; t++) {
      FRAME_TAGS[frameTagNames[t]] = true;
    }
    var FRAME_SELECTOR = frameTagNames.join(',');
    var FRAME_MARKUP = /<(?:[a-z0-9_.-]+:)?(?:iframe|frame|frameset|object|embed|portal|fencedframe)(?=[\\s/>]|$)/i;
    var NESTED_FRAME_MESSAGE = 'Nested frames, objects and embeds are not available in the custom panel.';
    var nodeTypeGetter = getOwnDescriptor(Node.prototype, 'nodeType').get;
    var localNameGetter = getOwnDescriptor(Element.prototype, 'localName').get;
    var elementQuery = Element.prototype.querySelector;
    var fragmentQuery = DocumentFragment.prototype.querySelector;
    var documentQueryAll = Document.prototype.querySelectorAll;
    var elementRemove = Element.prototype.remove;

    function lock(target, name, descriptor) {
      try {
        descriptor.configurable = false;
        defineProperty(target, name, descriptor);
      } catch (e) {
        // A property the browser does not let us redefine keeps its native behavior.
      }
    }

    function unavailable(name) {
      return function () {
        throw new SafeError(name + ' is not available in the custom panel.');
      };
    }

    var webrtc = [
      'RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection', 'RTCDataChannel',
      'RTCRtpSender', 'RTCRtpReceiver', 'RTCRtpTransceiver', 'RTCIceTransport', 'RTCDtlsTransport',
      'RTCSctpTransport', 'RTCIceCandidate', 'RTCSessionDescription', 'RTCCertificate', 'RTCDTMFSender',
      'RTCRtpScriptTransform', 'RTCIdentityProvider'
    ];
    for (var w = 0; w < webrtc.length; w++) {
      if (webrtc[w] in window) {
        lock(window, webrtc[w], { value: unavailable(webrtc[w]), writable: false, enumerable: false });
      }
    }

    function isFrameElement(node) {
      try {
        return FRAME_TAGS[reflectApply(localNameGetter, node, [])] === true;
      } catch (e) {
        return false;
      }
    }

    function containsFrame(node) {
      var type;
      try {
        type = reflectApply(nodeTypeGetter, node, []);
      } catch (e) {
        return false;
      }
      if (type === 1) {
        return isFrameElement(node) || reflectApply(elementQuery, node, [FRAME_SELECTOR]) !== null;
      }
      if (type === 11) {
        return reflectApply(fragmentQuery, node, [FRAME_SELECTOR]) !== null;
      }
      return false;
    }

    // Markup is coerced once, so a value whose toString changes between calls cannot slip through.
    function checkedMarkup(value) {
      var text = '' + value;
      if (reflectApply(regexpExec, FRAME_MARKUP, [text]) !== null) {
        throw new SafeError(NESTED_FRAME_MESSAGE);
      }
      return text;
    }

    function guardMethod(proto, name, check) {
      var original = proto && getOwnDescriptor(proto, name);
      if (!original || typeof original.value !== 'function') {
        return;
      }
      var method = original.value;
      lock(proto, name, {
        value: function () {
          return reflectApply(method, this, check(arguments));
        },
        writable: false,
        enumerable: original.enumerable
      });
    }

    function noFrameNodes(args) {
      var copy = [];
      for (var i = 0; i < args.length; i++) {
        if (containsFrame(args[i])) {
          throw new SafeError(NESTED_FRAME_MESSAGE);
        }
        copy.push(args[i]);
      }
      return copy;
    }

    function markupAt(index) {
      return function (args) {
        var copy = [];
        for (var i = 0; i < args.length; i++) {
          copy.push(i === index || index < 0 ? checkedMarkup(args[i]) : args[i]);
        }
        return copy;
      };
    }

    function guardMarkupSetter(proto, name) {
      var original = proto && getOwnDescriptor(proto, name);
      if (!original || typeof original.set !== 'function') {
        return;
      }
      var set = original.set;
      lock(proto, name, {
        get: original.get,
        set: function (value) {
          reflectApply(set, this, [value === null ? '' : checkedMarkup(value)]);
        },
        enumerable: original.enumerable
      });
    }

    function guardCreate(proto, name) {
      var original = proto && getOwnDescriptor(proto, name);
      if (!original || typeof original.value !== 'function') {
        return;
      }
      var create = original.value;
      lock(proto, name, {
        value: function () {
          var element = reflectApply(create, this, arguments);
          if (isFrameElement(element)) {
            throw new SafeError(NESTED_FRAME_MESSAGE);
          }
          return element;
        },
        writable: false,
        enumerable: original.enumerable
      });
    }

    guardCreate(Document.prototype, 'createElement');
    guardCreate(Document.prototype, 'createElementNS');

    var insertions = [
      [Node.prototype, ['appendChild', 'insertBefore', 'replaceChild', 'moveBefore']],
      [Element.prototype, ['append', 'prepend', 'before', 'after', 'replaceWith', 'replaceChildren', 'insertAdjacentElement']],
      [CharacterData.prototype, ['before', 'after', 'replaceWith']],
      [typeof DocumentType === 'function' ? DocumentType.prototype : null, ['before', 'after', 'replaceWith']],
      [Document.prototype, ['append', 'prepend', 'replaceChildren']],
      [DocumentFragment.prototype, ['append', 'prepend', 'replaceChildren']],
      [typeof Range === 'function' ? Range.prototype : null, ['insertNode', 'surroundContents']]
    ];
    for (var p = 0; p < insertions.length; p++) {
      for (var m = 0; m < insertions[p][1].length; m++) {
        guardMethod(insertions[p][0], insertions[p][1][m], noFrameNodes);
      }
    }

    var shadowProto = typeof ShadowRoot === 'function' ? ShadowRoot.prototype : null;
    guardMarkupSetter(Element.prototype, 'innerHTML');
    guardMarkupSetter(Element.prototype, 'outerHTML');
    guardMarkupSetter(shadowProto, 'innerHTML');
    guardMethod(Element.prototype, 'insertAdjacentHTML', markupAt(1));
    guardMethod(Element.prototype, 'setHTMLUnsafe', markupAt(0));
    guardMethod(Element.prototype, 'setHTML', markupAt(0));
    guardMethod(shadowProto, 'setHTMLUnsafe', markupAt(0));
    guardMethod(shadowProto, 'setHTML', markupAt(0));
    guardMethod(typeof Range === 'function' ? Range.prototype : null, 'createContextualFragment', markupAt(0));
    guardMethod(Document.prototype, 'write', markupAt(-1));
    guardMethod(Document.prototype, 'writeln', markupAt(-1));
    guardMethod(Document.prototype, 'execCommand', markupAt(2));

    var windowGetters = [
      [typeof HTMLIFrameElement === 'function' ? HTMLIFrameElement.prototype : null, ['contentWindow', 'contentDocument']],
      [typeof HTMLFrameElement === 'function' ? HTMLFrameElement.prototype : null, ['contentWindow', 'contentDocument']],
      [typeof HTMLObjectElement === 'function' ? HTMLObjectElement.prototype : null, ['contentWindow', 'contentDocument']]
    ];
    for (var g = 0; g < windowGetters.length; g++) {
      for (var n = 0; n < windowGetters[g][1].length; n++) {
        if (windowGetters[g][0] && getOwnDescriptor(windowGetters[g][0], windowGetters[g][1][n])) {
          lock(windowGetters[g][0], windowGetters[g][1][n], { get: function () { return null; }, enumerable: true });
        }
      }
    }
    var svgDocumentOwners = [
      typeof HTMLIFrameElement === 'function' ? HTMLIFrameElement.prototype : null,
      typeof HTMLObjectElement === 'function' ? HTMLObjectElement.prototype : null,
      typeof HTMLEmbedElement === 'function' ? HTMLEmbedElement.prototype : null
    ];
    for (var s = 0; s < svgDocumentOwners.length; s++) {
      if (svgDocumentOwners[s] && getOwnDescriptor(svgDocumentOwners[s], 'getSVGDocument')) {
        lock(svgDocumentOwners[s], 'getSVGDocument', { value: function () { return null; }, writable: false, enumerable: true });
      }
    }

    // A customized built-in that extends a frame element is constructed without createElement.
    if (typeof CustomElementRegistry === 'function') {
      var registryDefine = getOwnDescriptor(CustomElementRegistry.prototype, 'define');
      if (registryDefine && typeof registryDefine.value === 'function') {
        var define = registryDefine.value;
        lock(CustomElementRegistry.prototype, 'define', {
          value: function (name, constructor, options) {
            var extendsName = options === null || options === undefined ? undefined : options.extends;
            if (extendsName === undefined) {
              return reflectApply(define, this, [name, constructor]);
            }
            extendsName = '' + extendsName;
            if (FRAME_TAGS[extendsName] === true) {
              throw new SafeError(NESTED_FRAME_MESSAGE);
            }
            return reflectApply(define, this, [name, constructor, { extends: extendsName }]);
          },
          writable: false,
          enumerable: registryDefine.enumerable
        });
      }
    }

    // Backstop for an insertion path the guards above miss: remove the element and report it.
    if (typeof MutationObserver === 'function') {
      try {
        new MutationObserver(function () {
          var found = reflectApply(documentQueryAll, document, [FRAME_SELECTOR]);
          if (found.length === 0) {
            return;
          }
          for (var i = found.length - 1; i >= 0; i--) {
            reflectApply(elementRemove, found[i], []);
          }
          reportError('runtime', NESTED_FRAME_MESSAGE);
        }).observe(document, { childList: true, subtree: true });
      } catch (e) {
        // The guards above still apply.
      }
    }
  }

  /*
   * The nonce is in the bootstrap script (attribute, property and text) and in the CSP meta element.
   * Removing them does not change the enforced policy, which the browser fixed when it parsed them.
   * ReportingObserver would hand out the policy text of a violation, so it is replaced too.
   */
  function concealNonce() {
    if (bootstrapScript) {
      bootstrapScript.removeAttribute('nonce');
      bootstrapScript.nonce = '';
      bootstrapScript.textContent = '';
      if (bootstrapScript.parentNode) {
        bootstrapScript.parentNode.removeChild(bootstrapScript);
      }
      bootstrapScript = null;
    }
    var metas = document.querySelectorAll('meta[http-equiv]');
    for (var i = 0; i < metas.length; i++) {
      metas[i].parentNode.removeChild(metas[i]);
    }
    if ('ReportingObserver' in window) {
      try {
        Object.defineProperty(window, 'ReportingObserver', {
          value: function () {
            throw new Error('ReportingObserver is not available in the custom panel.');
          },
          writable: false,
          enumerable: false,
          configurable: false
        });
      } catch (e) {
        // Only violation reports would leak, and the code has no channel to send them out.
      }
    }
  }

  function nonceScript(text) {
    var element = document.createElement('script');
    element.setAttribute('nonce', NONCE);
    element.nonce = NONCE;
    element.textContent = text;
    return element;
  }

  function clearScript(element) {
    element.removeAttribute('nonce');
    element.nonce = '';
    element.textContent = '';
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /** A closed shadow root of the connected host if scripts run there, else the host itself. */
  function closedScriptRoot(host) {
    var shadow;
    try {
      shadow = host.attachShadow({ mode: 'closed' });
    } catch (e) {
      return host;
    }
    var flag = '__grafanaRenderShadowProbe';
    var probe = nonceScript('window.' + flag + ' = true;');
    shadow.appendChild(probe);
    var runs = window[flag] === true;
    try {
      delete window[flag];
    } catch (e) {
      window[flag] = undefined;
    }
    clearScript(probe);
    return runs ? shadow : host;
  }

  function noop() {}
  var raf = typeof window.requestAnimationFrame === 'function'
    ? function (callback) { window.requestAnimationFrame(callback); }
    : function (callback) { window.setTimeout(callback, 16); };
  var now = window.performance && typeof window.performance.now === 'function'
    ? function () { return window.performance.now(); }
    : function () { return Date.now(); };

  function toText(value) {
    var text;
    try {
      if (value && typeof value === 'object' && typeof value.message === 'string') {
        text = (typeof value.name === 'string' && value.name ? value.name + ': ' : '') + value.message;
      } else {
        text = String(value);
      }
    } catch (e) {
      text = 'Unknown error';
    }
    return text.length > MAX_DIAGNOSTIC_LENGTH ? text.slice(0, MAX_DIAGNOSTIC_LENGTH) : text;
  }

  function post(message) {
    if (!port) {
      return;
    }
    try {
      port.postMessage(message);
    } catch (e) {
      // The host closed the port; nothing else can be reported.
    }
  }

  function reportError(kind, value, seq) {
    var message = { type: 'error', kind: kind, message: toText(value) };
    if (typeof seq === 'number') {
      message.seq = seq;
    }
    if (port) {
      post(message);
    } else if (buffered.length < MAX_BUFFERED_ERRORS) {
      buffered.push(message);
    }
  }

  window.addEventListener('error', function (event) {
    var text = event && event.message ? String(event.message) : '';
    if (text.indexOf(RESIZE_OBSERVER_LOOP) === 0) {
      return;
    }
    var value = event && event.error !== undefined && event.error !== null ? event.error : text || 'Script error';
    if (runningUserCode) {
      startupFailed = true;
      reportError('startup', value);
    } else {
      reportError('runtime', value);
    }
  });
  window.addEventListener('unhandledrejection', function (event) {
    reportError('runtime', event ? event.reason : 'Unhandled promise rejection');
  });
  // One blocked request violates both this document's policy and the inherited wrapper policy,
  // so identical reports within the same task are sent once.
  var recentViolations = null;
  // Registered first, in the capture phase on window, so the event never reaches the user code:
  // its originalPolicy carries the nonce.
  window.addEventListener('securitypolicyviolation', function (event) {
    event.stopImmediatePropagation();
    var directive = event.violatedDirective || event.effectiveDirective || 'policy';
    var text = directive + ' ' + (event.blockedURI || 'inline');
    if (!recentViolations) {
      recentViolations = Object.create(null);
      window.setTimeout(function () { recentViolations = null; }, 0);
    }
    if (recentViolations[text]) {
      return;
    }
    recentViolations[text] = true;
    reportError('csp', text);
  }, true);

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).replace(/[&<>"']/g, function (character) { return ESCAPES[character]; });
  }

  function makeHelpers(input) {
    var series = input.data && Array.isArray(input.data.series) ? input.data.series : [];
    var timeZone = input.timeZone;
    return {
      escapeHtml: escapeHtml,
      frames: function () {
        return series.slice();
      },
      bySource: function () {
        var groups = [];
        var index = Object.create(null);
        for (var i = 0; i < series.length; i++) {
          var frame = series[i];
          var source = frame && frame.source;
          var panelId = source && typeof source.panelId === 'number' ? source.panelId : null;
          var key = panelId === null ? 'none' : 'panel-' + panelId;
          var group = index[key];
          if (!group) {
            group = { panelId: panelId, title: panelId !== null && typeof source.title === 'string' ? source.title : null, frames: [] };
            index[key] = group;
            groups.push(group);
          }
          group.frames.push(frame);
        }
        return groups;
      },
      field: function (frame, nameOrType) {
        var fields = frame && Array.isArray(frame.fields) ? frame.fields : [];
        var i;
        for (i = 0; i < fields.length; i++) {
          if (fields[i].name === nameOrType || fields[i].displayName === nameOrType) {
            return fields[i];
          }
        }
        for (i = 0; i < fields.length; i++) {
          if (fields[i].type === nameOrType) {
            return fields[i];
          }
        }
        return undefined;
      },
      last: function (field) {
        var values = field && Array.isArray(field.values) ? field.values : [];
        for (var i = values.length - 1; i >= 0; i--) {
          if (values[i] !== null && values[i] !== undefined) {
            return values[i];
          }
        }
        return null;
      },
      formatTime: function (ms, options) {
        var format = Object.assign({ timeZone: timeZone }, options || DEFAULT_TIME_FORMAT);
        try {
          return new Intl.DateTimeFormat(undefined, format).format(ms);
        } catch (e) {
          try {
            return new Intl.DateTimeFormat(undefined, options || DEFAULT_TIME_FORMAT).format(ms);
          } catch (e2) {
            return String(ms);
          }
        }
      }
    };
  }

  function applyTheme(theme) {
    if (!theme || !theme.colors) {
      return;
    }
    var key;
    try {
      key = JSON.stringify(theme);
    } catch (e) {
      return;
    }
    if (key === themeKey) {
      return;
    }
    themeKey = key;
    var style = document.documentElement.style;
    var colors = theme.colors;
    var typography = theme.typography || {};
    var vars = [
      ['--gf-color-text-primary', colors.text && colors.text.primary],
      ['--gf-color-text-secondary', colors.text && colors.text.secondary],
      ['--gf-color-text-link', colors.text && colors.text.link],
      ['--gf-color-bg-canvas', colors.background && colors.background.canvas],
      ['--gf-color-bg-primary', colors.background && colors.background.primary],
      ['--gf-color-bg-secondary', colors.background && colors.background.secondary],
      ['--gf-color-border-weak', colors.border && colors.border.weak],
      ['--gf-color-border-medium', colors.border && colors.border.medium],
      ['--gf-color-primary', colors.primary && colors.primary.main],
      ['--gf-color-success', colors.success && colors.success.main],
      ['--gf-color-warning', colors.warning && colors.warning.main],
      ['--gf-color-error', colors.error && colors.error.main],
      ['--gf-color-info', colors.info && colors.info.main],
      ['--gf-font-family', typography.fontFamily],
      ['--gf-font-family-mono', typography.fontFamilyMonospace],
      ['--gf-font-size', typeof typography.fontSize === 'number' ? typography.fontSize + 'px' : undefined],
      ['--gf-spacing', typeof theme.spacingGridSize === 'number' ? theme.spacingGridSize + 'px' : undefined],
      ['--gf-radius', theme.borderRadius]
    ];
    var palette = Array.isArray(theme.palette) ? theme.palette : [];
    for (var i = 0; i < palette.length; i++) {
      vars.push(['--gf-palette-' + i, palette[i]]);
    }
    for (var j = palette.length; j < paletteCount; j++) {
      style.removeProperty('--gf-palette-' + j);
    }
    paletteCount = palette.length;
    for (var k = 0; k < vars.length; k++) {
      if (typeof vars[k][1] === 'string') {
        style.setProperty(vars[k][0], vars[k][1]);
      } else {
        style.removeProperty(vars[k][0]);
      }
    }
    style.colorScheme = theme.mode === 'light' ? 'light' : 'dark';
  }

  function makeContext(job) {
    var input = job.input;
    return {
      root: root,
      seq: job.seq,
      data: input.data || { state: 'NotStarted', series: [], errors: [] },
      timeRange: input.timeRange,
      timeZone: input.timeZone,
      variables: input.variables || {},
      theme: input.theme,
      size: input.size,
      isRenderTarget: input.isRenderTarget === true,
      helpers: makeHelpers(input)
    };
  }

  function nextFrame() {
    return new Promise(function (resolve) { raf(function () { resolve(); }); });
  }

  function waitForPaint(isRenderTarget) {
    return nextFrame().then(nextFrame).then(function () {
      if (!isRenderTarget) {
        return undefined;
      }
      var waits = [];
      try {
        if (document.fonts && document.fonts.ready) {
          waits.push(Promise.resolve(document.fonts.ready).catch(noop));
        }
      } catch (e) {
        // Font loading is optional.
      }
      var images = root.getElementsByTagName('img');
      for (var i = 0; i < images.length; i++) {
        if (typeof images[i].decode === 'function') {
          try {
            waits.push(images[i].decode().catch(noop));
          } catch (e) {
            // A broken image must not block readiness.
          }
        }
      }
      return Promise.all(waits);
    }).catch(noop);
  }

  function schedule() {
    if (scheduled || drawing || paused || !pending || !draw || !port) {
      return;
    }
    scheduled = true;
    raf(runDraw);
  }

  function finish() {
    drawing = false;
    scheduleHeight();
    schedule();
  }

  function runDraw() {
    scheduled = false;
    if (drawing || paused || !pending || !draw) {
      return;
    }
    var job = pending;
    pending = null;
    drawing = true;
    var started = now();
    try {
      applyTheme(job.input.theme);
    } catch (e) {
      // A malformed theme must not stop the draw.
    }
    var result;
    try {
      result = draw(makeContext(job));
    } catch (error) {
      reportError('runtime', error, job.seq);
      finish();
      return;
    }
    Promise.resolve(result).then(function () {
      afterDraw(job, started);
    }, function (error) {
      reportError('runtime', error, job.seq);
      finish();
    });
  }

  function afterDraw(job, started) {
    var nodeCount = root.getElementsByTagName('*').length;
    if (nodeCount > MAX_DOM_NODES) {
      root.textContent = '';
      reportError('output-limit', 'The drawing created ' + nodeCount + ' elements, more than the limit of ' + MAX_DOM_NODES + '. The panel was cleared.', job.seq);
      finish();
      return;
    }
    scheduleHeight();
    waitForPaint(job.input.isRenderTarget === true).then(function () {
      post({ type: 'render-complete', seq: job.seq, durationMs: Math.max(0, now() - started), nodeCount: nodeCount });
      finish();
    });
  }

  function measureHeight() {
    heightScheduled = false;
    var height = document.documentElement ? document.documentElement.scrollHeight : 0;
    if (typeof height !== 'number' || !isFinite(height)) {
      return;
    }
    height = Math.max(0, Math.min(MAX_HEIGHT, Math.ceil(height)));
    if (height === lastHeight || !port) {
      return;
    }
    lastHeight = height;
    post({ type: 'height', height: height });
  }

  function scheduleHeight() {
    if (heightScheduled || !port) {
      return;
    }
    heightScheduled = true;
    raf(measureHeight);
  }

  if (typeof ResizeObserver === 'function') {
    try {
      var observer = new ResizeObserver(function () { scheduleHeight(); });
      observer.observe(document.documentElement);
      observer.observe(root);
    } catch (e) {
      // Height hints are optional.
    }
  }

  function findAnchor(target) {
    var node = target;
    if (node && node.nodeType !== 1) {
      node = node.parentElement || null;
    }
    if (!node || typeof node.closest !== 'function') {
      return null;
    }
    return node.closest('a,area');
  }

  function onLinkActivation(event) {
    var anchor = findAnchor(event.target);
    if (!anchor) {
      return;
    }
    var href = anchor.getAttribute('href');
    if (href === null && typeof anchor.getAttributeNS === 'function') {
      href = anchor.getAttributeNS(XLINK, 'href');
    }
    if (href === null) {
      return;
    }
    event.preventDefault();
    if (event.type !== 'click') {
      return;
    }
    href = String(href).trim();
    if (!href) {
      return;
    }
    if (href.charAt(0) === '#' && href.length > 1) {
      var id = null;
      try {
        id = decodeURIComponent(href.slice(1));
      } catch (e) {
        id = null;
      }
      var local = id ? document.getElementById(id) : null;
      if (local) {
        if (typeof local.scrollIntoView === 'function') {
          local.scrollIntoView();
        }
        return;
      }
    }
    if (href.length > MAX_HREF_LENGTH) {
      return;
    }
    post({ type: 'link', href: href });
  }
  window.addEventListener('click', onLinkActivation, true);
  window.addEventListener('auxclick', onLinkActivation, true);

  function onPortMessage(event) {
    var message = event && event.data;
    if (!message || typeof message !== 'object') {
      return;
    }
    switch (message.type) {
      case 'render':
        if (typeof message.seq !== 'number' || !message.input || typeof message.input !== 'object') {
          return;
        }
        lastInput = message.input;
        pending = { seq: message.seq, input: message.input };
        schedule();
        return;
      case 'resize':
        if (typeof message.seq !== 'number' || !message.size || !lastInput) {
          return;
        }
        lastInput = Object.assign({}, lastInput, { size: message.size });
        pending = { seq: message.seq, input: lastInput };
        schedule();
        return;
      case 'ping':
        if (typeof message.id === 'number') {
          post({ type: 'pong', id: message.id });
        }
        return;
      case 'pause':
        paused = true;
        return;
      case 'resume':
        if (paused) {
          paused = false;
          schedule();
        }
        return;
      default:
        return;
    }
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (port || event.source !== window.parent || !data || typeof data !== 'object' ||
        data.type !== INIT_TYPE || data.version !== VERSION || !event.ports || event.ports.length !== 1) {
      return;
    }
    port = event.ports[0];
    port.onmessage = onPortMessage;
    if (typeof port.start === 'function') {
      port.start();
    }
    var startupErrors = buffered;
    buffered = [];
    for (var i = 0; i < startupErrors.length; i++) {
      post(startupErrors[i]);
    }
    post({ type: 'ready', version: VERSION });
    schedule();
  });

  var api = {
    onRender: function (callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('panel.onRender(draw) expects a function.');
      }
      draw = callback;
      schedule();
    }
  };
  try {
    Object.defineProperty(window, 'panel', { value: Object.freeze(api), enumerable: true });
  } catch (e) {
    window.panel = api;
  }

  concealNonce();

  // The user script needs the nonce to run, so it runs inside a closed shadow root when the browser
  // runs scripts there: querySelector, document.scripts and document.currentScript cannot reach it.
  // Either way it loses its nonce and text, and leaves the document, as soon as it has run.
  var scriptHost = document.createElement('span');
  (document.body || document.documentElement).appendChild(scriptHost);
  var scriptParent = closedScriptRoot(scriptHost);
  var script = nonceScript(CODE);
  runningUserCode = true;
  try {
    scriptParent.appendChild(script);
  } finally {
    runningUserCode = false;
    clearScript(script);
    if (scriptHost.parentNode) {
      scriptHost.parentNode.removeChild(scriptHost);
    }
  }
  if (!draw && !startupFailed) {
    reportError('startup', 'The code did not call panel.onRender(draw) at the top level.');
  }
})();`;
