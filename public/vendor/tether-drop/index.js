import {
  extend,
  addClass,
  removeClass,
  hasClass,
  Evented,
} from "./tetherUtils";

function sortAttach(str) {
  let [first, second] = str.split(" ");
  if (["left", "right"].indexOf(first) >= 0) {
    [first, second] = [second, first];
  }
  return [first, second].join(" ");
}

function removeFromArray(arr, item) {
  let index;
  let results = [];
  while ((index = arr.indexOf(item)) !== -1) {
    results.push(arr.splice(index, 1));
  }
  return results;
}

let clickEvents = ["click"];
if ("ontouchstart" in document.documentElement) {
  clickEvents.push("touchstart");
}

const transitionEndEvents = {
  WebkitTransition: "webkitTransitionEnd",
  MozTransition: "transitionend",
  OTransition: "otransitionend",
  transition: "transitionend",
};

let transitionEndEvent = "";
for (let name in transitionEndEvents) {
  if ({}.hasOwnProperty.call(transitionEndEvents, name)) {
    let tempEl = document.createElement("p");
    if (typeof tempEl.style[name] !== "undefined") {
      transitionEndEvent = transitionEndEvents[name];
    }
  }
}

const MIRROR_ATTACH = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
  middle: "middle",
  center: "center",
};

let allDrops = {};

// Drop can be included in external libraries.  Calling createContext gives you a fresh
// copy of drop which won't interact with other copies on the page (beyond calling the document events).

function createContext(options = {}) {
  let drop = (...args) => new DropInstance(...args);

  extend(drop, {
    createContext: createContext,
    drops: [],
    defaults: {},
  });

  const defaultOptions = {
    classPrefix: "drop",
    defaults: {
      position: "bottom left",
      openOn: "click",
      beforeClose: null,
      constrainToScrollParent: true,
      constrainToWindow: true,
      classes: "",
      remove: false,
      openDelay: 0,
      closeDelay: 50,
      // inherited from openDelay and closeDelay if not explicitly defined
      focusDelay: null,
      blurDelay: null,
      hoverOpenDelay: null,
      hoverCloseDelay: null,
      tetherOptions: {},
    },
  };

  extend(drop, defaultOptions, options);
  extend(drop.defaults, defaultOptions.defaults, options.defaults);

  if (typeof allDrops[drop.classPrefix] === "undefined") {
    allDrops[drop.classPrefix] = [];
  }

  drop.updateBodyClasses = () => {
    // There is only one body, so despite the context concept, we still iterate through all
    // drops which share our classPrefix.

    let anyOpen = false;
    const drops = allDrops[drop.classPrefix];
    const len = drops.length;
    for (let i = 0; i < len; ++i) {
      if (drops[i].isOpened()) {
        anyOpen = true;
        break;
      }
    }

    if (anyOpen) {
      addClass(document.body, `${drop.classPrefix}-open`);
    } else {
      removeClass(document.body, `${drop.classPrefix}-open`);
    }
  };

  class DropInstance extends Evented {
    constructor(opts) {
      super();
      this.options = extend({}, drop.defaults, opts);
      this.target = this.options.target;

      if (typeof this.target === "undefined") {
        throw new Error("Drop Error: You must provide a target.");
      }

      const dataPrefix = `data-${drop.classPrefix}`;

      const contentAttr = this.target.getAttribute(dataPrefix);
      if (contentAttr && this.options.content == null) {
        this.options.content = contentAttr;
      }

      const attrsOverride = ["position", "openOn"];
      for (let i = 0; i < attrsOverride.length; ++i) {
        const override = this.target.getAttribute(
          `${dataPrefix}-${attrsOverride[i]}`
        );
        if (override && this.options[attrsOverride[i]] == null) {
          this.options[attrsOverride[i]] = override;
        }
      }

      if (this.options.classes && this.options.addTargetClasses !== false) {
        addClass(this.target, this.options.classes);
      }

      drop.drops.push(this);
      allDrops[drop.classPrefix].push(this);

      this._boundEvents = [];
      this.bindMethods();
      this.setupElements();
      this.setupEvents();
      this.setupTether();
    }

    _on(element, event, handler) {
      this._boundEvents.push({ element, event, handler });
      element.addEventListener(event, handler);
    }

    bindMethods() {
      this.transitionEndHandler = this._transitionEndHandler.bind(this);
    }

    setupElements() {
      this.drop = document.createElement("div");
      addClass(this.drop, drop.classPrefix);

      if (this.options.classes) {
        addClass(this.drop, this.options.classes);
      }

      this.content = document.createElement("div");
      addClass(this.content, `${drop.classPrefix}-content`);

      if (typeof this.options.content === "function") {
        const generateAndSetContent = () => {
          // content function might return a string or an element
          const contentElementOrHTML = this.options.content.call(this, this);

          if (typeof contentElementOrHTML === "string") {
            this.content.innerHTML = contentElementOrHTML;
          } else if (typeof contentElementOrHTML === "object") {
            this.content.innerHTML = "";
            this.content.appendChild(contentElementOrHTML);
          } else {
            throw new Error(
              "Drop Error: Content function should return a string or HTMLElement."
            );
          }
        };

        this.on("beforeOpen", generateAndSetContent.bind(this));
      } else if (typeof this.options.content === "object") {
        this.content.appendChild(this.options.content);
      } else {
        this.content.innerHTML = this.options.content;
      }

      this.drop.appendChild(this.content);
    }

    setupTether() {
      // Tether expects two attachment points, one in the target element, one in the
      // drop.  We use a single one, and use the order as well, to allow us to put
      // the drop on either side of any of the four corners.  This magic converts between
      // the two:
      let dropAttach = this.options.position.split(" ");
      dropAttach[0] = MIRROR_ATTACH[dropAttach[0]];
      dropAttach = dropAttach.join(" ");

      let constraints = [];
      if (this.options.constrainToScrollParent) {
        constraints.push({
          to: "scrollParent",
          pin: "top, bottom",
          attachment: "together none",
        });
      } else {
        // To get 'out of bounds' classes
        constraints.push({
          to: "scrollParent",
        });
      }

      if (this.options.constrainToWindow !== false) {
        constraints.push({
          to: "window",
          attachment: "together",
        });
      } else {
        // To get 'out of bounds' classes
        constraints.push({
          to: "window",
        });
      }

      const opts = {
        element: this.drop,
        target: this.target,
        attachment: sortAttach(dropAttach),
        targetAttachment: sortAttach(this.options.position),
        classPrefix: drop.classPrefix,
        offset: "0 0",
        targetOffset: "0 0",
        enabled: false,
        constraints: constraints,
        addTargetClasses: this.options.addTargetClasses,
      };

      if (this.options.tetherOptions !== false) {
        this.tether = new Tether(extend({}, opts, this.options.tetherOptions));
      }
    }

    setupEvents() {
      if (!this.options.openOn) {
        return;
      }

      if (this.options.openOn === "always") {
        setTimeout(this.open.bind(this));
        return;
      }

      const events = this.options.openOn.split(" ");

      if (events.indexOf("click") >= 0) {
        const openHandler = (event) => {
          this.toggle(event);
          event.preventDefault();
        };

        const closeHandler = (event) => {
          if (!this.isOpened()) {
            return;
          }

          // Clicking inside dropdown
          if (event.target === this.drop || this.drop.contains(event.target)) {
            return;
          }

          // Clicking target
          if (
            event.target === this.target ||
            this.target.contains(event.target)
          ) {
            return;
          }

          this.close(event);
        };

        for (let i = 0; i < clickEvents.length; ++i) {
          const clickEvent = clickEvents[i];
          this._on(this.target, clickEvent, openHandler);
          this._on(document, clickEvent, closeHandler);
        }
      }

      let inTimeout = null;
      let outTimeout = null;

      const inHandler = (event) => {
        if (outTimeout !== null) {
          clearTimeout(outTimeout);
        } else {
          inTimeout = setTimeout(() => {
            this.open(event);
            inTimeout = null;
          }, (event.type === "focus" ? this.options.focusDelay : this.options.hoverOpenDelay) || this.options.openDelay);
        }
      };

      const outHandler = (event) => {
        if (inTimeout !== null) {
          clearTimeout(inTimeout);
        } else {
          outTimeout = setTimeout(() => {
            this.close(event);
            outTimeout = null;
          }, (event.type === "blur" ? this.options.blurDelay : this.options.hoverCloseDelay) || this.options.closeDelay);
        }
      };

      if (events.indexOf("hover") >= 0) {
        this._on(this.target, "mouseover", inHandler);
        this._on(this.drop, "mouseover", inHandler);
        this._on(this.target, "mouseout", outHandler);
        this._on(this.drop, "mouseout", outHandler);
      }

      if (events.indexOf("focus") >= 0) {
        this._on(this.target, "focus", inHandler);
        this._on(this.drop, "focus", inHandler);
        this._on(this.target, "blur", outHandler);
        this._on(this.drop, "blur", outHandler);
      }
    }

    isOpened() {
      if (this.drop) {
        return hasClass(this.drop, `${drop.classPrefix}-open`);
      }
    }

    toggle(event) {
      if (this.isOpened()) {
        this.close(event);
      } else {
        this.open(event);
      }
    }

    open(event) {
      /* eslint no-unused-vars: 0 */
      if (this.isOpened()) {
        return;
      }

      if (!this.drop.parentNode) {
        document.body.appendChild(this.drop);
      }

      if (typeof this.tether !== "undefined") {
        this.tether.enable();
      }

      addClass(this.drop, `${drop.classPrefix}-open`);
      addClass(this.drop, `${drop.classPrefix}-open-transitionend`);

      setTimeout(() => {
        if (this.drop) {
          addClass(this.drop, `${drop.classPrefix}-after-open`);
        }
      });

      this.trigger("beforeOpen");

      if (typeof this.tether !== "undefined") {
        this.tether.position();
      }

      this.trigger("open");

      drop.updateBodyClasses();
    }

    _transitionEndHandler(e) {
      if (e.target !== e.currentTarget) {
        return;
      }

      if (!hasClass(this.drop, `${drop.classPrefix}-open`)) {
        removeClass(this.drop, `${drop.classPrefix}-open-transitionend`);
      }
      this.drop.removeEventListener(
        transitionEndEvent,
        this.transitionEndHandler
      );
    }

    beforeCloseHandler(event) {
      let shouldClose = true;

      if (!this.isClosing && typeof this.options.beforeClose === "function") {
        this.isClosing = true;
        shouldClose = this.options.beforeClose(event, this) !== false;
      }

      this.isClosing = false;

      return shouldClose;
    }

    close(event) {
      if (!this.isOpened()) {
        return;
      }

      if (!this.beforeCloseHandler(event)) {
        return;
      }

      removeClass(this.drop, `${drop.classPrefix}-open`);
      removeClass(this.drop, `${drop.classPrefix}-after-open`);

      this.drop.addEventListener(transitionEndEvent, this.transitionEndHandler);

      this.trigger("close");

      if (typeof this.tether !== "undefined") {
        this.tether.disable();
      }

      drop.updateBodyClasses();

      if (this.options.remove) {
        this.remove(event);
      }
    }

    remove(event) {
      this.close(event);
      if (this.drop.parentNode) {
        this.drop.parentNode.removeChild(this.drop);
      }
    }

    position() {
      if (this.isOpened() && typeof this.tether !== "undefined") {
        this.tether.position();
      }
    }

    destroy() {
      this.remove();

      if (typeof this.tether !== "undefined") {
        this.tether.destroy();
      }

      for (let i = 0; i < this._boundEvents.length; ++i) {
        const { element, event, handler } = this._boundEvents[i];
        element.removeEventListener(event, handler);
      }

      this._boundEvents = [];

      this.tether = null;
      this.drop = null;
      this.content = null;
      this.target = null;

      removeFromArray(allDrops[drop.classPrefix], this);
      removeFromArray(drop.drops, this);
    }
  }

  return drop;
}

const Drop = createContext();

export default Drop;

document.addEventListener("DOMContentLoaded", () => {
  Drop.updateBodyClasses();
});
