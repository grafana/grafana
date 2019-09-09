// Based on work https://github.com/mohsen1/json-formatter-js
// License MIT, Copyright (c) 2015 Mohsen Azimi

import { isObject, getObjectName, getType, getValuePreview, cssClass, createElement } from './helpers';

import _ from 'lodash';

const DATE_STRING_REGEX = /(^\d{1,4}[\.|\\/|-]\d{1,2}[\.|\\/|-]\d{1,4})(\s*(?:0?[1-9]:[0-5]|1(?=[012])\d:[0-5])\d\s*[ap]m)?$/;
const PARTIAL_DATE_REGEX = /\d{2}:\d{2}:\d{2} GMT-\d{4}/;
const JSON_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;

// When toggleing, don't animated removal or addition of more than a few items
const MAX_ANIMATED_TOGGLE_ITEMS = 10;

const requestAnimationFrame =
  window.requestAnimationFrame ||
  ((cb: () => void) => {
    cb();
    return 0;
  });

export interface JsonExplorerConfig {
  animateOpen?: boolean;
  animateClose?: boolean;
  theme?: string;
}

const _defaultConfig: JsonExplorerConfig = {
  animateOpen: true,
  animateClose: true,
};

/**
 * @class JsonExplorer
 *
 * JsonExplorer allows you to render JSON objects in HTML with a
 * **collapsible** navigation.
 */
export class JsonExplorer {
  // Hold the open state after the toggler is used
  private _isOpen: boolean | null = null;

  // A reference to the element that we render to
  private element: Element | null = null;

  private skipChildren = false;

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
  constructor(
    public json: any,
    private open = 1,
    private config: JsonExplorerConfig = _defaultConfig,
    private key?: string
  ) {}

  /*
   * is formatter open?
   */
  private get isOpen(): boolean {
    if (this._isOpen !== null) {
      return this._isOpen;
    } else {
      return this.open > 0;
    }
  }

  /*
   * set open state (from toggler)
   */
  private set isOpen(value: boolean) {
    this._isOpen = value;
  }

  /*
   * is this a date string?
   */
  private get isDate(): boolean {
    return (
      this.type === 'string' &&
      (DATE_STRING_REGEX.test(this.json) || JSON_DATE_REGEX.test(this.json) || PARTIAL_DATE_REGEX.test(this.json))
    );
  }

  /*
   * is this a URL string?
   */
  private get isUrl(): boolean {
    return this.type === 'string' && this.json.indexOf('http') === 0;
  }

  /*
   * is this an array?
   */
  private get isArray(): boolean {
    return Array.isArray(this.json);
  }

  /*
   * is this an object?
   * Note: In this context arrays are object as well
   */
  private get isObject(): boolean {
    return isObject(this.json);
  }

  /*
   * is this an empty object with no properties?
   */
  private get isEmptyObject(): boolean {
    return !this.keys.length && !this.isArray;
  }

  /*
   * is this an empty object or array?
   */
  private get isEmpty(): boolean {
    return this.isEmptyObject || (this.keys && !this.keys.length && this.isArray);
  }

  /*
   * did we receive a key argument?
   * This means that the formatter was called as a sub formatter of a parent formatter
   */
  private get hasKey(): boolean {
    return typeof this.key !== 'undefined';
  }

  /*
   * if this is an object, get constructor function name
   */
  private get constructorName(): string {
    return getObjectName(this.json);
  }

  /*
   * get type of this value
   * Possible values: all JavaScript primitive types plus "array" and "null"
   */
  private get type(): string {
    return getType(this.json);
  }

  /*
   * get object keys
   * If there is an empty key we pad it wit quotes to make it visible
   */
  private get keys(): string[] {
    if (this.isObject) {
      return Object.keys(this.json).map(key => (key ? key : '""'));
    } else {
      return [];
    }
  }

  /**
   * Toggles `isOpen` state
   *
   */
  toggleOpen() {
    this.isOpen = !this.isOpen;

    if (this.element) {
      if (this.isOpen) {
        this.appendChildren(this.config.animateOpen);
      } else {
        this.removeChildren(this.config.animateClose);
      }
      this.element.classList.toggle(cssClass('open'));
    }
  }

  /**
   * Open all children up to a certain depth.
   * Allows actions such as expand all/collapse all
   *
   */
  openAtDepth(depth = 1) {
    if (depth < 0) {
      return;
    }

    this.open = depth;
    this.isOpen = depth !== 0;

    if (this.element) {
      this.removeChildren(false);

      if (depth === 0) {
        this.element.classList.remove(cssClass('open'));
      } else {
        this.appendChildren(this.config.animateOpen);
        this.element.classList.add(cssClass('open'));
      }
    }
  }

  isNumberArray() {
    return this.json.length > 0 && this.json.length < 4 && (_.isNumber(this.json[0]) || _.isNumber(this.json[1]));
  }

  renderArray() {
    const arrayWrapperSpan = createElement('span');
    arrayWrapperSpan.appendChild(createElement('span', 'bracket', '['));

    // some pretty handling of number arrays
    if (this.isNumberArray()) {
      this.json.forEach((val: any, index: number) => {
        if (index > 0) {
          arrayWrapperSpan.appendChild(createElement('span', 'array-comma', ','));
        }
        arrayWrapperSpan.appendChild(createElement('span', 'number', val));
      });
      this.skipChildren = true;
    } else {
      arrayWrapperSpan.appendChild(createElement('span', 'number', this.json.length));
    }

    arrayWrapperSpan.appendChild(createElement('span', 'bracket', ']'));
    return arrayWrapperSpan;
  }

  /**
   * Renders an HTML element and installs event listeners
   *
   * @returns {HTMLDivElement}
   */
  render(skipRoot = false): HTMLDivElement {
    // construct the root element and assign it to this.element
    this.element = createElement('div', 'row');

    // construct the toggler link
    const togglerLink = createElement('a', 'toggler-link');
    const togglerIcon = createElement('span', 'toggler');

    // if this is an object we need a wrapper span (toggler)
    if (this.isObject) {
      togglerLink.appendChild(togglerIcon);
    }

    // if this is child of a parent formatter we need to append the key
    if (this.hasKey) {
      togglerLink.appendChild(createElement('span', 'key', `${this.key}:`));
    }

    // Value for objects and arrays
    if (this.isObject) {
      // construct the value holder element
      const value = createElement('span', 'value');

      // we need a wrapper span for objects
      const objectWrapperSpan = createElement('span');

      // get constructor name and append it to wrapper span
      const constructorName = createElement('span', 'constructor-name', this.constructorName);
      objectWrapperSpan.appendChild(constructorName);

      // if it's an array append the array specific elements like brackets and length
      if (this.isArray) {
        const arrayWrapperSpan = this.renderArray();
        objectWrapperSpan.appendChild(arrayWrapperSpan);
      }

      // append object wrapper span to toggler link
      value.appendChild(objectWrapperSpan);
      togglerLink.appendChild(value);
      // Primitive values
    } else {
      // make a value holder element
      const value = this.isUrl ? createElement('a') : createElement('span');

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
      const valuePreview = getValuePreview(this.json, this.json);
      value.appendChild(document.createTextNode(valuePreview));

      // append the value element to toggler link
      togglerLink.appendChild(value);
    }

    // construct a children element
    const children = createElement('div', 'children');

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
    } else {
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

    return this.element as HTMLDivElement;
  }

  /**
   * Appends all the children to children element
   * Animated option is used when user triggers this via a click
   */
  appendChildren(animated = false) {
    const children = this.element && this.element.querySelector(`div.${cssClass('children')}`);

    if (!children || this.isEmpty) {
      return;
    }

    if (animated) {
      let index = 0;
      const addAChild = () => {
        const key = this.keys[index];
        const formatter = new JsonExplorer(this.json[key], this.open - 1, this.config, key);
        children.appendChild(formatter.render());

        index += 1;

        if (index < this.keys.length) {
          if (index > MAX_ANIMATED_TOGGLE_ITEMS) {
            addAChild();
          } else {
            requestAnimationFrame(addAChild);
          }
        }
      };

      requestAnimationFrame(addAChild);
    } else {
      this.keys.forEach(key => {
        const formatter = new JsonExplorer(this.json[key], this.open - 1, this.config, key);
        children.appendChild(formatter.render());
      });
    }
  }

  /**
   * Removes all the children from children element
   * Animated option is used when user triggers this via a click
   */
  removeChildren(animated = false) {
    const childrenElement =
      this.element && (this.element.querySelector(`div.${cssClass('children')}`) as HTMLDivElement);

    if (animated) {
      let childrenRemoved = 0;
      const removeAChild = () => {
        if (childrenElement && childrenElement.children.length) {
          childrenElement.removeChild(childrenElement.children[0]);
          childrenRemoved += 1;
          if (childrenRemoved > MAX_ANIMATED_TOGGLE_ITEMS) {
            removeAChild();
          } else {
            requestAnimationFrame(removeAChild);
          }
        }
      };
      requestAnimationFrame(removeAChild);
    } else {
      if (childrenElement) {
        childrenElement.innerHTML = '';
      }
    }
  }
}
