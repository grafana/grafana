let TetherBase;
if (typeof TetherBase === "undefined") {
  TetherBase = { modules: [] };
}

let zeroElement = null;

// Same as native getBoundingClientRect, except it takes into account parent <frame> offsets
// if the element lies within a nested document (<frame> or <iframe>-like).
function getActualBoundingClientRect(node) {
  let boundingRect = node.getBoundingClientRect();

  // The original object returned by getBoundingClientRect is immutable, so we clone it
  // We can't use extend because the properties are not considered part of the object by hasOwnProperty in IE9
  let rect = {};
  for (var k in boundingRect) {
    rect[k] = boundingRect[k];
  }

  try {
    if (node.ownerDocument !== document) {
      let frameElement = node.ownerDocument.defaultView.frameElement;
      if (frameElement) {
        let frameRect = getActualBoundingClientRect(frameElement);
        rect.top += frameRect.top;
        rect.bottom += frameRect.top;
        rect.left += frameRect.left;
        rect.right += frameRect.left;
      }
    }
  } catch (err) {
    // Ignore "Access is denied" in IE11/Edge
  }

  return rect;
}

function getScrollParents(el) {
  // In firefox if the el is inside an iframe with display: none; window.getComputedStyle() will return null;
  // https://bugzilla.mozilla.org/show_bug.cgi?id=548397
  const computedStyle = getComputedStyle(el) || {};
  const position = computedStyle.position;
  let parents = [];

  if (position === "fixed") {
    return [el];
  }

  let parent = el;
  while ((parent = parent.parentNode) && parent && parent.nodeType === 1) {
    let style;
    try {
      style = getComputedStyle(parent);
    } catch (err) {}

    if (typeof style === "undefined" || style === null) {
      parents.push(parent);
      return parents;
    }

    const { overflow, overflowX, overflowY } = style;
    if (/(auto|scroll|overlay)/.test(overflow + overflowY + overflowX)) {
      if (
        position !== "absolute" ||
        ["relative", "absolute", "fixed"].indexOf(style.position) >= 0
      ) {
        parents.push(parent);
      }
    }
  }

  parents.push(el.ownerDocument.body);

  // If the node is within a frame, account for the parent window scroll
  if (el.ownerDocument !== document) {
    parents.push(el.ownerDocument.defaultView);
  }

  return parents;
}

const uniqueId = (() => {
  let id = 0;
  return () => ++id;
})();

const zeroPosCache = {};
const getOrigin = () => {
  // getBoundingClientRect is unfortunately too accurate.  It introduces a pixel or two of
  // jitter as the user scrolls that messes with our ability to detect if two positions
  // are equivilant or not.  We place an element at the top left of the page that will
  // get the same jitter, so we can cancel the two out.
  let node = zeroElement;
  if (!node || !document.body.contains(node)) {
    node = document.createElement("div");
    node.setAttribute("data-tether-id", uniqueId());
    extend(node.style, {
      top: 0,
      left: 0,
      position: "absolute",
    });

    document.body.appendChild(node);

    zeroElement = node;
  }

  const id = node.getAttribute("data-tether-id");
  if (typeof zeroPosCache[id] === "undefined") {
    zeroPosCache[id] = getActualBoundingClientRect(node);

    // Clear the cache when this position call is done
    defer(() => {
      delete zeroPosCache[id];
    });
  }

  return zeroPosCache[id];
};

function removeUtilElements() {
  if (zeroElement) {
    document.body.removeChild(zeroElement);
  }
  zeroElement = null;
}

function getBounds(el) {
  let doc;
  if (el === document) {
    doc = document;
    el = document.documentElement;
  } else {
    doc = el.ownerDocument;
  }

  const docEl = doc.documentElement;

  const box = getActualBoundingClientRect(el);

  const origin = getOrigin();

  box.top -= origin.top;
  box.left -= origin.left;

  if (typeof box.width === "undefined") {
    box.width = document.body.scrollWidth - box.left - box.right;
  }
  if (typeof box.height === "undefined") {
    box.height = document.body.scrollHeight - box.top - box.bottom;
  }

  box.top = box.top - docEl.clientTop;
  box.left = box.left - docEl.clientLeft;
  box.right = doc.body.clientWidth - box.width - box.left;
  box.bottom = doc.body.clientHeight - box.height - box.top;

  return box;
}

function getOffsetParent(el) {
  return el.offsetParent || document.documentElement;
}

let _scrollBarSize = null;
function getScrollBarSize() {
  if (_scrollBarSize) {
    return _scrollBarSize;
  }
  const inner = document.createElement("div");
  inner.style.width = "100%";
  inner.style.height = "200px";

  const outer = document.createElement("div");
  extend(outer.style, {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none",
    visibility: "hidden",
    width: "200px",
    height: "150px",
    overflow: "hidden",
  });

  outer.appendChild(inner);

  document.body.appendChild(outer);

  const widthContained = inner.offsetWidth;
  outer.style.overflow = "scroll";
  let widthScroll = inner.offsetWidth;

  if (widthContained === widthScroll) {
    widthScroll = outer.clientWidth;
  }

  document.body.removeChild(outer);

  const width = widthContained - widthScroll;

  _scrollBarSize = { width, height: width };
  return _scrollBarSize;
}

function extend(out = {}) {
  const args = [];

  Array.prototype.push.apply(args, arguments);

  args.slice(1).forEach((obj) => {
    if (obj) {
      for (let key in obj) {
        if ({}.hasOwnProperty.call(obj, key)) {
          out[key] = obj[key];
        }
      }
    }
  });

  return out;
}

function removeClass(el, name) {
  if (typeof el.classList !== "undefined") {
    name.split(" ").forEach((cls) => {
      if (cls.trim()) {
        el.classList.remove(cls);
      }
    });
  } else {
    const regex = new RegExp(`(^| )${name.split(" ").join("|")}( |$)`, "gi");
    const className = getClassName(el).replace(regex, " ");
    setClassName(el, className);
  }
}

function addClass(el, name) {
  if (typeof el.classList !== "undefined") {
    name.split(" ").forEach((cls) => {
      if (cls.trim()) {
        el.classList.add(cls);
      }
    });
  } else {
    removeClass(el, name);
    const cls = getClassName(el) + ` ${name}`;
    setClassName(el, cls);
  }
}

function hasClass(el, name) {
  if (typeof el.classList !== "undefined") {
    return el.classList.contains(name);
  }
  const className = getClassName(el);
  return new RegExp(`(^| )${name}( |$)`, "gi").test(className);
}

function getClassName(el) {
  // Can't use just SVGAnimatedString here since nodes within a Frame in IE have
  // completely separately SVGAnimatedString base classes
  if (el.className instanceof el.ownerDocument.defaultView.SVGAnimatedString) {
    return el.className.baseVal;
  }
  return el.className;
}

function setClassName(el, className) {
  el.setAttribute("class", className);
}

function updateClasses(el, add, all) {
  // Of the set of 'all' classes, we need the 'add' classes, and only the
  // 'add' classes to be set.
  all.forEach((cls) => {
    if (add.indexOf(cls) === -1 && hasClass(el, cls)) {
      removeClass(el, cls);
    }
  });

  add.forEach((cls) => {
    if (!hasClass(el, cls)) {
      addClass(el, cls);
    }
  });
}

const deferred = [];

const defer = (fn) => {
  deferred.push(fn);
};

const flush = () => {
  let fn;
  while ((fn = deferred.pop())) {
    fn();
  }
};

class Evented {
  on(event, handler, ctx, once = false) {
    if (typeof this.bindings === "undefined") {
      this.bindings = {};
    }
    if (typeof this.bindings[event] === "undefined") {
      this.bindings[event] = [];
    }
    this.bindings[event].push({ handler, ctx, once });
  }

  once(event, handler, ctx) {
    this.on(event, handler, ctx, true);
  }

  off(event, handler) {
    if (
      typeof this.bindings === "undefined" ||
      typeof this.bindings[event] === "undefined"
    ) {
      return;
    }

    if (typeof handler === "undefined") {
      delete this.bindings[event];
    } else {
      let i = 0;
      while (i < this.bindings[event].length) {
        if (this.bindings[event][i].handler === handler) {
          this.bindings[event].splice(i, 1);
        } else {
          ++i;
        }
      }
    }
  }

  trigger(event, ...args) {
    if (typeof this.bindings !== "undefined" && this.bindings[event]) {
      let i = 0;
      while (i < this.bindings[event].length) {
        const { handler, ctx, once } = this.bindings[event][i];

        let context = ctx;
        if (typeof context === "undefined") {
          context = this;
        }

        handler.apply(context, args);

        if (once) {
          this.bindings[event].splice(i, 1);
        } else {
          ++i;
        }
      }
    }
  }
}

export {
  getActualBoundingClientRect,
  getScrollParents,
  getBounds,
  getOffsetParent,
  extend,
  addClass,
  removeClass,
  hasClass,
  updateClasses,
  defer,
  flush,
  uniqueId,
  Evented,
  getScrollBarSize,
  removeUtilElements,
};
