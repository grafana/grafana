// Based on work https://github.com/mohsen1/json-formatter-js
// License MIT, Copyright (c) 2015 Mohsen Azimi
import { isObject, getObjectName, getType, getValuePreview, cssClass, createElement } from './helpers';
import _ from 'lodash';
var DATE_STRING_REGEX = /(^\d{1,4}[\.|\\/|-]\d{1,2}[\.|\\/|-]\d{1,4})(\s*(?:0?[1-9]:[0-5]|1(?=[012])\d:[0-5])\d\s*[ap]m)?$/;
var PARTIAL_DATE_REGEX = /\d{2}:\d{2}:\d{2} GMT-\d{4}/;
var JSON_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;
// When toggleing, don't animated removal or addition of more than a few items
var MAX_ANIMATED_TOGGLE_ITEMS = 10;
var requestAnimationFrame = window.requestAnimationFrame ||
    (function (cb) {
        cb();
        return 0;
    });
var _defaultConfig = {
    animateOpen: true,
    animateClose: true,
    theme: null,
};
/**
 * @class JsonExplorer
 *
 * JsonExplorer allows you to render JSON objects in HTML with a
 * **collapsible** navigation.
 */
var JsonExplorer = /** @class */ (function () {
    /**
     * @param {object} json The JSON object you want to render. It has to be an
     * object or array. Do NOT pass raw JSON string.
     *
     * @param {number} [open=1] his number indicates up to how many levels the
     * rendered tree should expand. Set it to `0` to make the whole tree collapsed
     * or set it to `Infinity` to expand the tree deeply
     *
     * @param {object} [config=defaultConfig] -
     *  defaultConfig = {
     *   hoverPreviewEnabled: false,
     *   hoverPreviewArrayCount: 100,
     *   hoverPreviewFieldCount: 5
     * }
     *
     * Available configurations:
     *  #####Hover Preview
     * * `hoverPreviewEnabled`:  enable preview on hover
     * * `hoverPreviewArrayCount`: number of array items to show in preview Any
     *    array larger than this number will be shown as `Array[XXX]` where `XXX`
     *    is length of the array.
     * * `hoverPreviewFieldCount`: number of object properties to show for object
     *   preview. Any object with more properties that thin number will be
     *   truncated.
     *
     * @param {string} [key=undefined] The key that this object in it's parent
     * context
     */
    function JsonExplorer(json, open, config, key) {
        if (open === void 0) { open = 1; }
        if (config === void 0) { config = _defaultConfig; }
        this.json = json;
        this.open = open;
        this.config = config;
        this.key = key;
        // Hold the open state after the toggler is used
        this._isOpen = null;
        this.skipChildren = false;
    }
    Object.defineProperty(JsonExplorer.prototype, "isOpen", {
        /*
         * is formatter open?
         */
        get: function () {
            if (this._isOpen !== null) {
                return this._isOpen;
            }
            else {
                return this.open > 0;
            }
        },
        /*
         * set open state (from toggler)
         */
        set: function (value) {
            this._isOpen = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "isDate", {
        /*
         * is this a date string?
         */
        get: function () {
            return (this.type === 'string' &&
                (DATE_STRING_REGEX.test(this.json) || JSON_DATE_REGEX.test(this.json) || PARTIAL_DATE_REGEX.test(this.json)));
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "isUrl", {
        /*
         * is this a URL string?
         */
        get: function () {
            return this.type === 'string' && this.json.indexOf('http') === 0;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "isArray", {
        /*
         * is this an array?
         */
        get: function () {
            return Array.isArray(this.json);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "isObject", {
        /*
         * is this an object?
         * Note: In this context arrays are object as well
         */
        get: function () {
            return isObject(this.json);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "isEmptyObject", {
        /*
         * is this an empty object with no properties?
         */
        get: function () {
            return !this.keys.length && !this.isArray;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "isEmpty", {
        /*
         * is this an empty object or array?
         */
        get: function () {
            return this.isEmptyObject || (this.keys && !this.keys.length && this.isArray);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "hasKey", {
        /*
         * did we receive a key argument?
         * This means that the formatter was called as a sub formatter of a parent formatter
         */
        get: function () {
            return typeof this.key !== 'undefined';
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "constructorName", {
        /*
         * if this is an object, get constructor function name
         */
        get: function () {
            return getObjectName(this.json);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "type", {
        /*
         * get type of this value
         * Possible values: all JavaScript primitive types plus "array" and "null"
         */
        get: function () {
            return getType(this.json);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonExplorer.prototype, "keys", {
        /*
         * get object keys
         * If there is an empty key we pad it wit quotes to make it visible
         */
        get: function () {
            if (this.isObject) {
                return Object.keys(this.json).map(function (key) { return (key ? key : '""'); });
            }
            else {
                return [];
            }
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Toggles `isOpen` state
     *
     */
    JsonExplorer.prototype.toggleOpen = function () {
        this.isOpen = !this.isOpen;
        if (this.element) {
            if (this.isOpen) {
                this.appendChildren(this.config.animateOpen);
            }
            else {
                this.removeChildren(this.config.animateClose);
            }
            this.element.classList.toggle(cssClass('open'));
        }
    };
    /**
     * Open all children up to a certain depth.
     * Allows actions such as expand all/collapse all
     *
     */
    JsonExplorer.prototype.openAtDepth = function (depth) {
        if (depth === void 0) { depth = 1; }
        if (depth < 0) {
            return;
        }
        this.open = depth;
        this.isOpen = depth !== 0;
        if (this.element) {
            this.removeChildren(false);
            if (depth === 0) {
                this.element.classList.remove(cssClass('open'));
            }
            else {
                this.appendChildren(this.config.animateOpen);
                this.element.classList.add(cssClass('open'));
            }
        }
    };
    JsonExplorer.prototype.isNumberArray = function () {
        return this.json.length > 0 && this.json.length < 4 && (_.isNumber(this.json[0]) || _.isNumber(this.json[1]));
    };
    JsonExplorer.prototype.renderArray = function () {
        var arrayWrapperSpan = createElement('span');
        arrayWrapperSpan.appendChild(createElement('span', 'bracket', '['));
        // some pretty handling of number arrays
        if (this.isNumberArray()) {
            this.json.forEach(function (val, index) {
                if (index > 0) {
                    arrayWrapperSpan.appendChild(createElement('span', 'array-comma', ','));
                }
                arrayWrapperSpan.appendChild(createElement('span', 'number', val));
            });
            this.skipChildren = true;
        }
        else {
            arrayWrapperSpan.appendChild(createElement('span', 'number', this.json.length));
        }
        arrayWrapperSpan.appendChild(createElement('span', 'bracket', ']'));
        return arrayWrapperSpan;
    };
    /**
     * Renders an HTML element and installs event listeners
     *
     * @returns {HTMLDivElement}
     */
    JsonExplorer.prototype.render = function (skipRoot) {
        if (skipRoot === void 0) { skipRoot = false; }
        // construct the root element and assign it to this.element
        this.element = createElement('div', 'row');
        // construct the toggler link
        var togglerLink = createElement('a', 'toggler-link');
        var togglerIcon = createElement('span', 'toggler');
        // if this is an object we need a wrapper span (toggler)
        if (this.isObject) {
            togglerLink.appendChild(togglerIcon);
        }
        // if this is child of a parent formatter we need to append the key
        if (this.hasKey) {
            togglerLink.appendChild(createElement('span', 'key', this.key + ":"));
        }
        // Value for objects and arrays
        if (this.isObject) {
            // construct the value holder element
            var value = createElement('span', 'value');
            // we need a wrapper span for objects
            var objectWrapperSpan = createElement('span');
            // get constructor name and append it to wrapper span
            var constructorName = createElement('span', 'constructor-name', this.constructorName);
            objectWrapperSpan.appendChild(constructorName);
            // if it's an array append the array specific elements like brackets and length
            if (this.isArray) {
                var arrayWrapperSpan = this.renderArray();
                objectWrapperSpan.appendChild(arrayWrapperSpan);
            }
            // append object wrapper span to toggler link
            value.appendChild(objectWrapperSpan);
            togglerLink.appendChild(value);
            // Primitive values
        }
        else {
            // make a value holder element
            var value = this.isUrl ? createElement('a') : createElement('span');
            // add type and other type related CSS classes
            value.classList.add(cssClass(this.type));
            if (this.isDate) {
                value.classList.add(cssClass('date'));
            }
            if (this.isUrl) {
                value.classList.add(cssClass('url'));
                value.setAttribute('href', this.json);
            }
            // Append value content to value element
            var valuePreview = getValuePreview(this.json, this.json);
            value.appendChild(document.createTextNode(valuePreview));
            // append the value element to toggler link
            togglerLink.appendChild(value);
        }
        // construct a children element
        var children = createElement('div', 'children');
        // set CSS classes for children
        if (this.isObject) {
            children.classList.add(cssClass('object'));
        }
        if (this.isArray) {
            children.classList.add(cssClass('array'));
        }
        if (this.isEmpty) {
            children.classList.add(cssClass('empty'));
        }
        // set CSS classes for root element
        if (this.config && this.config.theme) {
            this.element.classList.add(cssClass(this.config.theme));
        }
        if (this.isOpen) {
            this.element.classList.add(cssClass('open'));
        }
        // append toggler and children elements to root element
        if (!skipRoot) {
            this.element.appendChild(togglerLink);
        }
        if (!this.skipChildren) {
            this.element.appendChild(children);
        }
        else {
            // remove togglerIcon
            togglerLink.removeChild(togglerIcon);
        }
        // if formatter is set to be open call appendChildren
        if (this.isObject && this.isOpen) {
            this.appendChildren();
        }
        // add event listener for toggling
        if (this.isObject) {
            togglerLink.addEventListener('click', this.toggleOpen.bind(this));
        }
        return this.element;
    };
    /**
     * Appends all the children to children element
     * Animated option is used when user triggers this via a click
     */
    JsonExplorer.prototype.appendChildren = function (animated) {
        var _this = this;
        if (animated === void 0) { animated = false; }
        var children = this.element.querySelector("div." + cssClass('children'));
        if (!children || this.isEmpty) {
            return;
        }
        if (animated) {
            var index_1 = 0;
            var addAChild_1 = function () {
                var key = _this.keys[index_1];
                var formatter = new JsonExplorer(_this.json[key], _this.open - 1, _this.config, key);
                children.appendChild(formatter.render());
                index_1 += 1;
                if (index_1 < _this.keys.length) {
                    if (index_1 > MAX_ANIMATED_TOGGLE_ITEMS) {
                        addAChild_1();
                    }
                    else {
                        requestAnimationFrame(addAChild_1);
                    }
                }
            };
            requestAnimationFrame(addAChild_1);
        }
        else {
            this.keys.forEach(function (key) {
                var formatter = new JsonExplorer(_this.json[key], _this.open - 1, _this.config, key);
                children.appendChild(formatter.render());
            });
        }
    };
    /**
     * Removes all the children from children element
     * Animated option is used when user triggers this via a click
     */
    JsonExplorer.prototype.removeChildren = function (animated) {
        if (animated === void 0) { animated = false; }
        var childrenElement = this.element.querySelector("div." + cssClass('children'));
        if (animated) {
            var childrenRemoved_1 = 0;
            var removeAChild_1 = function () {
                if (childrenElement && childrenElement.children.length) {
                    childrenElement.removeChild(childrenElement.children[0]);
                    childrenRemoved_1 += 1;
                    if (childrenRemoved_1 > MAX_ANIMATED_TOGGLE_ITEMS) {
                        removeAChild_1();
                    }
                    else {
                        requestAnimationFrame(removeAChild_1);
                    }
                }
            };
            requestAnimationFrame(removeAChild_1);
        }
        else {
            if (childrenElement) {
                childrenElement.innerHTML = '';
            }
        }
    };
    return JsonExplorer;
}());
export { JsonExplorer };
//# sourceMappingURL=json_explorer.js.map