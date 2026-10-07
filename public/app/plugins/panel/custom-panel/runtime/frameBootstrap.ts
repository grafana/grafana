import {
  MAX_CAPTURE_LENGTH,
  MAX_DIAGNOSTIC_LENGTH,
  MAX_DOM_NODES,
  MAX_HEIGHT_HINT_PX,
  MAX_HREF_LENGTH,
  LAYOUT_GRID_CELLS,
  MAX_LAYOUT_ELEMENTS,
  MAX_LAYOUT_EMPTY_REGIONS,
  MAX_LAYOUT_LABEL_LENGTH,
  MAX_LAYOUT_SAMPLES,
  MAX_LAYOUT_TEXT_RECTS,
  RENDER_INIT_MESSAGE_TYPE,
  RENDER_PROTOCOL_VERSION,
  RENDER_TARGET_CLASS,
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
export const BOOTSTRAP_API_VERSION_PLACEHOLDER = '__RENDER_API_VERSION__';

const INIT_TYPE = JSON.stringify(RENDER_INIT_MESSAGE_TYPE);
const TARGET_CLASS = JSON.stringify(RENDER_TARGET_CLASS);

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
  var API_VERSION = ${BOOTSTRAP_API_VERSION_PLACEHOLDER};
  var MAX_DIAGNOSTIC_LENGTH = ${MAX_DIAGNOSTIC_LENGTH};
  var MAX_DOM_NODES = ${MAX_DOM_NODES};
  var MAX_HEIGHT = ${MAX_HEIGHT_HINT_PX};
  var MAX_HREF_LENGTH = ${MAX_HREF_LENGTH};
  var MAX_CAPTURE_LENGTH = ${MAX_CAPTURE_LENGTH};
  var MAX_LAYOUT_ELEMENTS = ${MAX_LAYOUT_ELEMENTS};
  var MAX_LAYOUT_TEXT_RECTS = ${MAX_LAYOUT_TEXT_RECTS};
  var MAX_LAYOUT_SAMPLES = ${MAX_LAYOUT_SAMPLES};
  var MAX_LAYOUT_EMPTY_REGIONS = ${MAX_LAYOUT_EMPTY_REGIONS};
  var MAX_LAYOUT_LABEL = ${MAX_LAYOUT_LABEL_LENGTH};
  var LAYOUT_GRID = ${LAYOUT_GRID_CELLS};
  var MAX_BUFFERED_ERRORS = 20;
  var RESIZE_OBSERVER_LOOP = 'ResizeObserver loop';
  var XLINK = 'http://www.w3.org/1999/xlink';
  var CSS_VARIABLE = /^--gf-[a-z0-9-]+$/;
  // Read before the user code runs, which could remove the class.
  var IS_RENDER_TARGET = document.documentElement.classList.contains(${TARGET_CLASS});

  hardenRealm();

  // Captured before the user code runs, so a drawing that replaces them only breaks its own capture.
  var SafeXMLSerializer = window.XMLSerializer;
  var SafeImage = window.Image;
  var encodeComponent = window.encodeURIComponent;
  var safeComputedStyle = window.getComputedStyle;

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
  var appliedVars = [];

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

  function isTransparentColor(value) {
    var color = String(value || '').split(' ').join('');
    return color === '' || color === 'transparent' || color.slice(-3) === ',0)';
  }

  /** The drawing's own background, else the theme's panel background. */
  function captureBackground(html) {
    try {
      var candidates = [document.body, html];
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i]) {
          var color = safeComputedStyle.call(window, candidates[i]).backgroundColor;
          if (!isTransparentColor(color)) {
            return color;
          }
        }
      }
      var themed = String(safeComputedStyle.call(window, html).getPropertyValue('--gf-color-bg-primary')).trim();
      return themed || null;
    } catch (e) {
      return null;
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

  function applyTheme(theme) {
    if (!theme || !theme.vars || typeof theme.vars !== 'object') {
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
    for (var i = 0; i < appliedVars.length; i++) {
      style.removeProperty(appliedVars[i]);
    }
    appliedVars = [];
    var names = Object.keys(theme.vars);
    for (var j = 0; j < names.length; j++) {
      var value = theme.vars[names[j]];
      if (CSS_VARIABLE.test(names[j]) && typeof value === 'string') {
        style.setProperty(names[j], value);
        appliedVars.push(names[j]);
      }
    }
    style.colorScheme = theme.colorScheme === 'light' ? 'light' : 'dark';
  }

  // ctx mirrors PanelProps; root is the only addition. The theme reaches the code as CSS only.
  function makeContext(input) {
    return {
      root: root,
      id: input.id,
      title: input.title,
      data: input.data,
      timeRange: input.timeRange,
      timeZone: input.timeZone,
      options: input.options,
      fieldConfig: input.fieldConfig,
      width: input.width,
      height: input.height,
      transparent: input.transparent === true,
      fitContent: input.fitContent === true,
      location: input.location
    };
  }

  function nextFrame() {
    return new Promise(function (resolve) { raf(function () { resolve(); }); });
  }

  function waitForPaint() {
    return nextFrame().then(nextFrame).then(function () {
      if (!IS_RENDER_TARGET) {
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
      result = draw(makeContext(job.input));
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

  /*
   * The layout report: a bounded summary of where the draw put its content, so a caller that
   * cannot see the panel can tell a bad layout (content cut, spilling out, piled up or lost in a
   * mostly empty panel). It reads the DOM only. The drawing runs in this realm and can skew its own
   * report, so the host bounds and validates it like any other message.
   */
  var LAYOUT_MEDIA = { img: true, svg: true, canvas: true, video: true, input: true, select: true, textarea: true, progress: true, meter: true };

  function layoutArea(rect) {
    return rect ? (rect.right - rect.left) * (rect.bottom - rect.top) : 0;
  }

  function layoutIntersect(a, b) {
    var left = Math.max(a.left, b.left);
    var top = Math.max(a.top, b.top);
    var right = Math.min(a.right, b.right);
    var bottom = Math.min(a.bottom, b.bottom);
    return right > left && bottom > top ? { left: left, top: top, right: right, bottom: bottom } : null;
  }

  function layoutCut(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function layoutName(element) {
    var name = String(element.tagName || '').toLowerCase();
    if (typeof element.id === 'string' && element.id) {
      name += '#' + element.id;
    }
    var classes = element.classList;
    for (var i = 0; classes && i < classes.length && i < 2; i++) {
      name += '.' + classes[i];
    }
    return name;
  }

  function layoutLabel(element) {
    var parent = element.parentElement;
    var name = parent && parent !== root && parent !== document.body ? layoutName(parent) + ' > ' + layoutName(element) : layoutName(element);
    return layoutCut(name, MAX_LAYOUT_LABEL);
  }

  function layoutText(value) {
    return layoutCut(String(value).split(/\\s+/).join(' ').trim(), MAX_LAYOUT_LABEL);
  }

  function layoutBox(rect) {
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.right - rect.left),
      height: Math.round(rect.bottom - rect.top)
    };
  }

  function layoutRound(value) {
    return Math.round(value * 100) / 100;
  }

  function isPainted(style) {
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      return true;
    }
    if (!isTransparentColor(style.backgroundColor)) {
      return true;
    }
    if (style.boxShadow && style.boxShadow !== 'none') {
      return true;
    }
    if (style.borderStyle === 'none' || style.borderStyle === '') {
      return false;
    }
    var sides = ['Top', 'Right', 'Bottom', 'Left'];
    for (var i = 0; i < sides.length; i++) {
      if (parseFloat(style['border' + sides[i] + 'Width']) > 0 && style['border' + sides[i] + 'Style'] !== 'none' &&
        !isTransparentColor(style['border' + sides[i] + 'Color'])) {
        return true;
      }
    }
    return false;
  }

  /** The clip a box with this overflow puts on its content, per axis; null when it clips nothing. */
  function overflowClip(box, overflowX, overflowY, values) {
    var clipX = values[overflowX] === true;
    var clipY = values[overflowY] === true;
    if (!clipX && !clipY) {
      return null;
    }
    return {
      left: clipX ? box.left : -Infinity,
      right: clipX ? box.right : Infinity,
      top: clipY ? box.top : -Infinity,
      bottom: clipY ? box.bottom : Infinity
    };
  }

  var CLIPPING = { hidden: true, clip: true, auto: true, scroll: true };
  var CUTTING = { hidden: true, clip: true };
  var NOTHING = { left: 0, top: 0, right: 0, bottom: 0 };

  function narrow(clip, next) {
    if (!next) {
      return clip;
    }
    return clip ? layoutIntersect(clip, next) || NOTHING : next;
  }

  /** The largest rectangle of empty cells, as [col, row, cols, rows], or null. */
  function largestEmpty(empty, cols, rows) {
    var heights = [];
    for (var c = 0; c < cols; c++) {
      heights.push(0);
    }
    var best = null;
    var bestArea = 0;
    for (var r = 0; r < rows; r++) {
      for (var x = 0; x < cols; x++) {
        heights[x] = empty[r * cols + x] ? heights[x] + 1 : 0;
      }
      var stack = [];
      for (var i = 0; i <= cols; i++) {
        var h = i < cols ? heights[i] : 0;
        while (stack.length > 0 && heights[stack[stack.length - 1]] >= h) {
          var top = stack.pop();
          var start = stack.length > 0 ? stack[stack.length - 1] + 1 : 0;
          var area = heights[top] * (i - start);
          if (area > bestArea) {
            bestArea = area;
            best = [start, r - heights[top] + 1, i - start, heights[top]];
          }
        }
        stack.push(i);
      }
    }
    return best;
  }

  function measureLayout(fitContent) {
    var started = now();
    var html = document.documentElement;
    var width = html.clientWidth;
    var height = html.clientHeight;
    if (!(width > 0 && height > 0)) {
      return null;
    }
    var view = { left: 0, top: 0, right: width, bottom: height };
    var viewArea = width * height;
    var cols = Math.max(1, Math.min(LAYOUT_GRID, Math.ceil(width / 16)));
    var rows = Math.max(1, Math.min(LAYOUT_GRID, Math.ceil(height / 16)));
    var cellWidth = width / cols;
    var cellHeight = height / rows;
    var cells = [];
    for (var n = 0; n < cols * rows; n++) {
      cells.push(0);
    }

    function cover(rect) {
      var onView = rect && layoutIntersect(rect, view);
      if (!onView) {
        return;
      }
      var c0 = Math.floor(onView.left / cellWidth);
      var c1 = Math.min(cols - 1, Math.ceil(onView.right / cellWidth) - 1);
      var r0 = Math.floor(onView.top / cellHeight);
      var r1 = Math.min(rows - 1, Math.ceil(onView.bottom / cellHeight) - 1);
      for (var y = r0; y <= r1; y++) {
        var overlapY = Math.min(onView.bottom, (y + 1) * cellHeight) - Math.max(onView.top, y * cellHeight);
        for (var x = c0; x <= c1; x++) {
          var overlapX = Math.min(onView.right, (x + 1) * cellWidth) - Math.max(onView.left, x * cellWidth);
          if (overlapX > 0 && overlapY > 0) {
            cells[y * cols + x] += overlapX * overlapY;
          }
        }
      }
    }

    var overflowing = { count: 0, samples: [] };
    var clippedText = { count: 0, samples: [] };
    var overlaps = { count: 0, samples: [] };
    var outside = new Map();
    var siblings = new Map();
    var runs = [];
    var textRects = 0;
    var range = typeof document.createRange === 'function' ? document.createRange() : null;
    var inspected = 0;
    var truncated = false;
    var queue = [{ element: root, clip: null, cut: null }];

    while (queue.length > 0) {
      var item = queue.pop();
      var element = item.element;
      if (inspected >= MAX_LAYOUT_ELEMENTS) {
        truncated = true;
        break;
      }
      inspected++;
      var style = safeComputedStyle.call(window, element);
      if (style.display === 'none' || style.opacity === '0') {
        continue;
      }
      var tag = String(element.tagName || '').toLowerCase();
      var visible = style.visibility === 'visible';
      var r = element.getBoundingClientRect();
      var box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      var shown = item.clip ? layoutIntersect(box, item.clip) : layoutArea(box) > 0 ? box : null;

      if (shown && visible) {
        var sides = [];
        if (shown.left < -1) {
          sides.push('left');
        }
        if (shown.top < -1) {
          sides.push('top');
        }
        if (shown.right > width + 1) {
          sides.push('right');
        }
        if (!fitContent && shown.bottom > height + 1) {
          sides.push('bottom');
        }
        if (sides.length > 0) {
          outside.set(element, true);
          if (!outside.has(element.parentElement)) {
            overflowing.count++;
            if (overflowing.samples.length < MAX_LAYOUT_SAMPLES) {
              var sample = layoutBox(shown);
              sample.element = layoutLabel(element);
              sample.sides = sides;
              overflowing.samples.push(sample);
            }
          }
        }
        if (element !== root && (LAYOUT_MEDIA[tag] === true || (layoutArea(shown) <= viewArea / 2 && isPainted(style)))) {
          cover(shown);
        }
      }

      if (element !== root && visible && shown && layoutArea(shown) >= 16) {
        var parent = element.parentElement;
        var list = siblings.get(parent);
        if (!list) {
          list = [];
          siblings.set(parent, list);
        }
        if (list.length < 40 && (style.float === 'none' || !style.float) && style.position !== 'absolute' && style.position !== 'fixed') {
          list.push({ element: element, rect: shown });
        }
      }

      if (LAYOUT_MEDIA[tag] === true) {
        continue;
      }
      var overflowX = style.overflowX;
      var overflowY = style.overflowY;
      var clips = overflowX !== 'visible' || overflowY !== 'visible';
      var clip = clips ? narrow(item.clip, overflowClip(box, overflowX, overflowY, CLIPPING)) : item.clip;
      var cut = clips ? narrow(item.cut, overflowClip(box, overflowX, overflowY, CUTTING)) : item.cut;

      if (visible && range) {
        var total = 0;
        var kept = 0;
        var excerpt = null;
        for (var node = element.firstChild; node; node = node.nextSibling) {
          if (node.nodeType !== 3 || !String(node.data).trim()) {
            continue;
          }
          if (!excerpt) {
            excerpt = node;
          }
          range.selectNodeContents(node);
          var fragments = typeof range.getClientRects === 'function' ? range.getClientRects() : [];
          var run = { element: element, node: node, rects: [], bounds: null };
          for (var f = 0; f < fragments.length; f++) {
            var fragment = { left: fragments[f].left, top: fragments[f].top, right: fragments[f].right, bottom: fragments[f].bottom };
            var fragmentArea = layoutArea(fragment);
            if (!(fragmentArea > 0)) {
              continue;
            }
            total += fragmentArea;
            kept += cut ? layoutArea(layoutIntersect(fragment, cut)) : fragmentArea;
            var seen = clip ? layoutIntersect(fragment, clip) : fragment;
            if (seen) {
              cover(seen);
              if (textRects < MAX_LAYOUT_TEXT_RECTS) {
                run.rects.push(seen);
                run.bounds = run.bounds ? {
                  left: Math.min(run.bounds.left, seen.left),
                  top: Math.min(run.bounds.top, seen.top),
                  right: Math.max(run.bounds.right, seen.right),
                  bottom: Math.max(run.bounds.bottom, seen.bottom)
                } : seen;
                textRects++;
              }
            }
          }
          if (run.rects.length > 0) {
            runs.push(run);
          }
        }
        var share = total > 0 ? kept / total : 1;
        var tooWide = excerpt && cut && element.clientWidth > 0 &&
          (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) &&
          (CUTTING[overflowX] === true || CUTTING[overflowY] === true);
        if (excerpt && (share < 0.98 || tooWide)) {
          clippedText.count++;
          if (clippedText.samples.length < MAX_LAYOUT_SAMPLES) {
            clippedText.samples.push({
              element: layoutLabel(element),
              text: layoutText(excerpt.data),
              visible: layoutRound(Math.max(0, Math.min(1, tooWide && share >= 0.98 ? element.clientWidth / element.scrollWidth : share))),
              ellipsis: style.textOverflow === 'ellipsis'
            });
          }
        }
      }

      var children = element.children;
      for (var k = children.length - 1; k >= 0; k--) {
        queue.push({ element: children[k], clip: clip, cut: cut });
      }
    }
    if (queue.length > 0) {
      truncated = true;
    }

    function addOverlap(entry) {
      overlaps.count++;
      if (overlaps.samples.length < MAX_LAYOUT_SAMPLES) {
        overlaps.samples.push(entry);
      }
    }

    // Text lines over other text lines: almost never intended. Sorted by top, so each run is only
    // compared with the runs that start above its bottom.
    runs.sort(function (left, right) {
      return left.bounds.top - right.bounds.top;
    });
    for (var a = 0; a < runs.length; a++) {
      var first = runs[a];
      for (var b = a + 1; b < runs.length && runs[b].bounds.top < first.bounds.bottom; b++) {
        var second = runs[b];
        if (second.bounds.left >= first.bounds.right || second.bounds.right <= first.bounds.left) {
          continue;
        }
        var worst = 0;
        for (var i = 0; i < first.rects.length; i++) {
          for (var j = 0; j < second.rects.length; j++) {
            var common = layoutArea(layoutIntersect(first.rects[i], second.rects[j]));
            if (common >= 16 && common > worst &&
              common >= Math.min(layoutArea(first.rects[i]), layoutArea(second.rects[j])) * 0.3) {
              worst = common;
            }
          }
        }
        if (worst > 0) {
          addOverlap({ kind: 'text', a: layoutLabel(first.element), b: layoutLabel(second.element), area: Math.round(worst), aText: layoutText(first.node.data), bText: layoutText(second.node.data) });
        }
      }
    }

    // In-flow siblings over each other: absolute and fixed boxes are layered on purpose.
    siblings.forEach(function (list) {
      for (var a = 0; a < list.length; a++) {
        for (var b = a + 1; b < list.length; b++) {
          var common = layoutArea(layoutIntersect(list[a].rect, list[b].rect));
          if (common >= 16 && common >= Math.min(layoutArea(list[a].rect), layoutArea(list[b].rect)) * 0.25) {
            addOverlap({ kind: 'box', a: layoutLabel(list[a].element), b: layoutLabel(list[b].element), area: Math.round(common) });
          }
        }
      }
    });

    var cellArea = cellWidth * cellHeight;
    var covered = 0;
    var empty = [];
    for (var e = 0; e < cells.length; e++) {
      covered += Math.min(cells[e], cellArea);
      empty.push(cells[e] < cellArea * 0.1);
    }
    var emptyRegions = [];
    while (emptyRegions.length < MAX_LAYOUT_EMPTY_REGIONS) {
      var found = largestEmpty(empty, cols, rows);
      if (!found || found[2] * found[3] < cells.length * 0.1) {
        break;
      }
      for (var y = found[1]; y < found[1] + found[3]; y++) {
        for (var x = found[0]; x < found[0] + found[2]; x++) {
          empty[y * cols + x] = false;
        }
      }
      var region = layoutBox({
        left: found[0] * cellWidth,
        top: found[1] * cellHeight,
        right: (found[0] + found[2]) * cellWidth,
        bottom: (found[1] + found[3]) * cellHeight
      });
      region.share = layoutRound((found[2] * found[3]) / cells.length);
      emptyRegions.push(region);
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
      coverage: layoutRound(Math.min(1, covered / viewArea)),
      emptyRegions: emptyRegions,
      overflowing: overflowing,
      clippedText: clippedText,
      overlaps: overlaps,
      inspected: inspected,
      truncated: truncated,
      durationMs: Math.round((now() - started) * 10) / 10
    };
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
    waitForPaint().then(function () {
      var message = { type: 'render-complete', seq: job.seq, durationMs: Math.max(0, now() - started), nodeCount: nodeCount };
      var layout = null;
      try {
        layout = measureLayout(job.input.fitContent === true);
      } catch (e) {
        // The report is optional; a drawing that breaks the DOM APIs only loses it.
      }
      if (layout) {
        message.layout = layout;
      }
      post(message);
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

  function postCapture(id, image, error) {
    var message = { type: 'capture', id: id };
    if (image) {
      message.image = image;
    } else {
      message.error = toText(error || 'The drawing could not be captured.');
    }
    post(message);
  }

  function removeElements(container, tagName) {
    var found = container.getElementsByTagName(tagName);
    for (var i = found.length - 1; i >= 0; i--) {
      found[i].parentNode.removeChild(found[i]);
    }
  }

  /*
   * The host cannot read this opaque document, so the frame rasterizes itself: a copy of the
   * document goes into an SVG foreignObject image, which is drawn on a canvas. Canvases become
   * images first, because their pixels are not part of the markup. Inside the image the root
   * element is the svg, so :root rules are rewritten to html.
   */
  function captureDrawing(id) {
    try {
      var html = document.documentElement;
      var width = Math.max(1, Math.ceil(html.clientWidth));
      var height = Math.max(1, Math.ceil(html.clientHeight));
      var copy = html.cloneNode(true);
      removeElements(copy, 'script');
      removeElements(copy, 'meta');
      var styles = copy.getElementsByTagName('style');
      for (var s = 0; s < styles.length; s++) {
        styles[s].textContent = String(styles[s].textContent).split(':root').join('html');
      }
      var canvases = html.getElementsByTagName('canvas');
      var copies = copy.getElementsByTagName('canvas');
      for (var c = copies.length - 1; c >= 0; c--) {
        var source = canvases[c];
        var image = document.createElement('img');
        try {
          image.src = source.toDataURL('image/png');
        } catch (e) {
          // A canvas that cannot be read stays empty in the capture.
        }
        image.setAttribute('style', source.getAttribute('style') || '');
        image.style.width = source.clientWidth + 'px';
        image.style.height = source.clientHeight + 'px';
        if (source.className && typeof source.className === 'string') {
          image.className = source.className;
        }
        copies[c].parentNode.replaceChild(image, copies[c]);
      }
      // Links lose their page styling inside the image; carry the computed look over.
      var anchors = html.getElementsByTagName('a');
      var anchorCopies = copy.getElementsByTagName('a');
      for (var a = 0; a < anchorCopies.length && a < anchors.length; a++) {
        var look = safeComputedStyle.call(window, anchors[a]);
        anchorCopies[a].style.color = look.color;
        anchorCopies[a].style.textDecoration = look.textDecoration;
      }
      var background = captureBackground(html);
      var markup = new SafeXMLSerializer().serializeToString(copy);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
        '<foreignObject x="0" y="0" width="100%" height="100%">' + markup + '</foreignObject></svg>';
      var picture = new SafeImage();
      picture.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var context = canvas.getContext('2d');
          // A capture is read on its own, away from the panel behind the frame, so it gets the
          // panel background instead of staying transparent.
          if (background) {
            context.fillStyle = background;
            context.fillRect(0, 0, width, height);
          }
          context.drawImage(picture, 0, 0, width, height);
          var url = canvas.toDataURL('image/png');
          if (url.length > MAX_CAPTURE_LENGTH) {
            postCapture(id, null, 'The captured drawing is larger than ' + MAX_CAPTURE_LENGTH + ' characters.');
            return;
          }
          postCapture(id, url);
        } catch (e) {
          postCapture(id, null, e);
        }
      };
      picture.onerror = function () {
        postCapture(id, null, 'The browser could not rasterize the drawing.');
      };
      picture.src = 'data:image/svg+xml;charset=utf-8,' + encodeComponent(svg);
    } catch (e) {
      postCapture(id, null, e);
    }
  }

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
        lastInput = Object.assign({}, lastInput, { width: message.size.width, height: message.size.height });
        pending = { seq: message.seq, input: lastInput };
        schedule();
        return;
      case 'ping':
        if (typeof message.id === 'number') {
          post({ type: 'pong', id: message.id });
        }
        return;
      case 'capture':
        if (typeof message.id === 'number') {
          captureDrawing(message.id);
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
    apiVersion: API_VERSION,
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
