/**
 * Originally from https://github.com/ccampbell/mousetrap
 *
 * Copyright 2012-2017 Craig Campbell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Mousetrap is a simple keyboard shortcut library for Javascript with
 * no external dependencies
 *
 * @version 1.6.5
 * @url craig.is/killing/mice
 */

interface ExtendedKeyboardEvent extends KeyboardEvent {
  returnValue: boolean; // IE returnValue
}

type MousetrapCallback = (e: ExtendedKeyboardEvent, combo: string) => boolean | void;

interface KeyInfo {
  key: string;
  modifiers: string[];
  action: string;
}

interface CallbackInfo {
  /**
   * Modifiers (such as `ctrl`) involved in this binding
   */
  modifiers: string[];

  /**
   * A single key press binding, such as `t` (for `t v`) or  `ctrl + z`
   */
  combo: string;

  /**
   * If this binding is a part of a sequence (`t v`, but not `ctrl + z`), this is the full sequence
   */
  seq?: string;

  /**
   * The event type, such as keydown, keyup, or keypress
   */
  action: string;
  level: number | undefined;
  callback: MousetrapCallback;
}

/**
 * mapping of special keycodes to their corresponding keys
 *
 * everything in this dictionary cannot use keypress events
 * so it has to be here to map to the correct keycodes for
 * keyup/keydown events
 */
let MAP: Record<string, string> = {
  8: 'backspace',
  9: 'tab',
  13: 'enter',
  16: 'shift',
  17: 'ctrl',
  18: 'alt',
  20: 'capslock',
  27: 'esc',
  32: 'space',
  33: 'pageup',
  34: 'pagedown',
  35: 'end',
  36: 'home',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  45: 'ins',
  46: 'del',
  91: 'meta',
  93: 'meta',
  224: 'meta',
};

/**
 * mapping for special characters so they can support
 *
 * this dictionary is only used incase you want to bind a
 * keyup or keydown event to one of these keys
 */
let KEYCODE_MAP: Record<string, string> = {
  106: '*',
  107: '+',
  109: '-',
  110: '.',
  111: '/',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
};

/**
 * this is a mapping of keys that require shift on a US keypad
 * back to the non shift equivelents
 *
 * this is so you can use keyup events with these keys
 *
 * note that this will only work reliably on US keyboards
 */
let SHIFT_MAP: Record<string, string> = {
  '~': '`',
  '!': '1',
  '@': '2',
  '#': '3',
  $: '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0',
  _: '-',
  '+': '=',
  ':': ';',
  '"': "'",
  '<': ',',
  '>': '.',
  '?': '/',
  '|': '\\',
};

/**
 * this is a list of special strings you can use to map
 * to modifier keys when you specify your keyboard shortcuts
 */
let SPECIAL_ALIASES: Record<string, string> = {
  option: 'alt',
  command: 'meta',
  return: 'enter',
  escape: 'esc',
  plus: '+',
  mod: /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl',
};

/**
 * variable to store the flipped version of _MAP from above
 * needed to check if we should use keypress or not when no action
 * is specified
 */
let REVERSE_MAP: Record<string, string> | null = null;

/**
 * loop through the f keys, f1 to f19 and add them to the map
 * programatically
 */
for (let i = 1; i < 20; ++i) {
  MAP[111 + i] = 'f' + i;
}

/**
 * loop through to map numbers on the numeric keypad
 */
for (let i = 0; i <= 9; ++i) {
  // This needs to use a string cause otherwise since 0 is falsey
  // mousetrap will never fire for numpad 0 pressed as part of a keydown
  // event.
  //
  // @see https://github.com/ccampbell/mousetrap/pull/258
  MAP[i + 96] = i.toString();
}

/**
 * takes the event and returns the key character
 */
function characterFromEvent(event: KeyboardEvent): string {
  // for keypress events we should return the character as is
  if (event.type === 'keypress') {
    let character = String.fromCharCode(event.which);

    // if the shift key is not pressed then it is safe to assume
    // that we want the character to be lowercase.  this means if
    // you accidentally have caps lock on then your key bindings
    // will continue to work
    //
    // the only side effect that might not be desired is if you
    // bind something like 'A' cause you want to trigger an
    // event when capital A is pressed caps lock will no longer
    // trigger the event.  shift+a will though.
    if (!event.shiftKey) {
      character = character.toLowerCase();
    }

    return character;
  }

  // for non keypress events the special maps are needed
  if (MAP[event.which]) {
    return MAP[event.which];
  }

  if (KEYCODE_MAP[event.which]) {
    return KEYCODE_MAP[event.which];
  }

  // if it is not in the special map

  // with keydown and keyup events the character seems to always
  // come in as an uppercase character whether you are pressing shift
  // or not.  we should make sure it is always lowercase for comparisons
  return String.fromCharCode(event.which).toLowerCase();
}

/**
 * checks if two arrays are equal
 */
function modifiersMatch(modifiers1: string[], modifiers2: string[]): boolean {
  return modifiers1.sort().join(',') === modifiers2.sort().join(',');
}

/**
 * takes a key event and figures out what the modifiers are
 */
function eventModifiers(event: KeyboardEvent): string[] {
  let modifiers = [];

  if (event.shiftKey) {
    modifiers.push('shift');
  }

  if (event.altKey) {
    modifiers.push('alt');
  }

  if (event.ctrlKey) {
    modifiers.push('ctrl');
  }

  if (event.metaKey) {
    modifiers.push('meta');
  }

  return modifiers;
}

/**
 * prevents default for this event
 */
function preventDefault(event: KeyboardEvent): void {
  if (event.preventDefault) {
    event.preventDefault();
    return;
  }

  event.returnValue = false;
}

/**
 * stops propogation for this event
 */
function stopPropagation(event: KeyboardEvent): void {
  if (event.stopPropagation) {
    event.stopPropagation();
    return;
  }

  event.cancelBubble = true;
}

/**
 * determines if the keycode specified is a modifier key or not
 */
function isModifier(key: string): boolean {
  return key === 'shift' || key === 'ctrl' || key === 'alt' || key === 'meta';
}

/**
 * reverses the map lookup so that we can look for specific keys
 * to see what can and can't use keypress
 */
function getReverseMap() {
  if (!REVERSE_MAP) {
    REVERSE_MAP = {};
    for (let key in MAP) {
      const keyNumber = parseInt(key, 10);
      // pull out the numeric keypad from here cause keypress should
      // be able to detect the keys from the character
      if (keyNumber > 95 && keyNumber < 112) {
        continue;
      }

      if (MAP.hasOwnProperty(key)) {
        REVERSE_MAP[MAP[key]] = key;
      }
    }
  }
  return REVERSE_MAP;
}

/**
 * picks the best action based on the key combination
 */
function pickBestAction(key: string, modifiers: string[], action?: string): string {
  // if no action was picked in we should try to pick the one
  // that we think would work best for this key
  if (!action) {
    action = getReverseMap()[key] ? 'keydown' : 'keypress';
  }

  // modifier keys don't work as expected with keypress,
  // switch to keydown
  if (action === 'keypress' && modifiers.length) {
    action = 'keydown';
  }

  return action;
}

/**
 * Converts from a string key combination to an array
 */
function keysFromString(combination: string): string[] {
  if (combination === '+') {
    return ['+'];
  }

  combination = combination.replace(/\+{2}/g, '+plus');
  return combination.split('+');
}

/**
 * Gets info for a specific key combination
 */
function getKeyInfo(combination: string, action?: string): KeyInfo {
  let keys;
  let key;
  let i;
  let modifiers = [];

  // take the keys from this pattern and figure out what the actual
  // pattern is all about
  keys = keysFromString(combination);

  for (i = 0; i < keys.length; ++i) {
    key = keys[i];

    // normalize key names
    if (SPECIAL_ALIASES[key]) {
      key = SPECIAL_ALIASES[key];
    }

    // if this is not a keypress event then we should
    // be smart about using shift keys
    // this will only work for US keyboards however
    if (action && action !== 'keypress' && SHIFT_MAP[key]) {
      key = SHIFT_MAP[key];
      modifiers.push('shift');
    }

    // if this key is a modifier then add it to the list of modifiers
    if (isModifier(key)) {
      modifiers.push(key);
    }
  }

  if (!key) {
    throw new Error('Unable to get key');
  }

  // depending on what the key combination is
  // we will try to pick the best event for it
  action = pickBestAction(key, modifiers, action);

  return {
    key: key,
    modifiers: modifiers,
    action: action,
  };
}

function belongsTo(element: null | ParentNode | Element | Document, ancestor: Element | Document) {
  if (element === null || element === document) {
    return false;
  }

  if (element === ancestor) {
    return true;
  }

  return belongsTo(element.parentNode, ancestor);
}

export class Mousetrap {
  target: HTMLElement | Document;

  /**
   * a list of all the callbacks setup via Mousetrap.bind()
   */
  _callbacks: Record<string, CallbackInfo[]> = {};

  /**
   * direct map of string combinations to callbacks used for trigger()
   */
  _directMap: Record<string, Function> = {};

  /**
   * keeps track of what level each sequence is at since multiple
   * sequences can start out with the same sequence
   */
  _sequenceLevels: Record<string, number> = {};

  /**
   * variable to store the setTimeout call
   */
  _resetTimer: undefined | number = undefined;

  /**
   * temporary state where we will ignore the next keyup
   */
  _ignoreNextKeyup: boolean | string = false;

  /**
   * temporary state where we will ignore the next keypress
   */
  _ignoreNextKeypress = false;

  /**
   * are we currently inside of a sequence?
   * type of action ("keyup" or "keydown" or "keypress") or false
   */
  _nextExpectedAction: boolean | string = false;

  _globalCallbacks: Record<string, boolean> = {};

  constructor(el: HTMLElement | Document) {
    this.target = el;

    this.target.addEventListener('keypress', (event) => {
      if (event instanceof KeyboardEvent) {
        this._handleKeyEvent(event);
      }
    });
    this.target.addEventListener('keydown', (event) => {
      if (event instanceof KeyboardEvent) {
        this._handleKeyEvent(event);
      }
    });
    this.target.addEventListener('keyup', (event) => {
      if (event instanceof KeyboardEvent) {
        this._handleKeyEvent(event);
      }
    });
  }

  /**
   * resets all sequence counters except for the ones passed in
   */
  private _resetSequences = (doNotReset: Record<string, number>): void => {
    doNotReset = doNotReset || {};

    let activeSequences = false,
      key;

    for (key in this._sequenceLevels) {
      if (doNotReset[key]) {
        activeSequences = true;
        continue;
      }
      this._sequenceLevels[key] = 0;
    }

    if (!activeSequences) {
      this._nextExpectedAction = false;
    }
  };

  /**
   * finds all callbacks that match based on the keycode, modifiers,
   * and action
   */
  private _getMatches = (
    character: string,
    modifiers: string[],
    event: Pick<KeyboardEvent, 'type' | 'metaKey' | 'ctrlKey'>,
    sequenceName?: string,
    combination?: string,
    level?: number
  ): CallbackInfo[] => {
    let i;
    let callback;
    let matches = [];
    let action = event.type;

    // if there are no events related to this keycode
    if (!this._callbacks[character]) {
      return [];
    }

    // if a modifier key is coming up on its own we should allow it
    if (action === 'keyup' && isModifier(character)) {
      modifiers = [character];
    }

    // loop through all callbacks for the key that was pressed
    // and see if any of them match
    for (i = 0; i < this._callbacks[character].length; ++i) {
      callback = this._callbacks[character][i];

      // if a sequence name is not specified, but this is a sequence at
      // the wrong level then move onto the next match
      if (!sequenceName && callback.seq && this._sequenceLevels[callback.seq] !== callback.level) {
        continue;
      }

      // if the action we are looking for doesn't match the action we got
      // then we should keep going
      if (action !== callback.action) {
        continue;
      }

      // if this is a keypress event and the meta key and control key
      // are not pressed that means that we need to only look at the
      // character, otherwise check the modifiers as well
      //
      // chrome will not fire a keypress if meta or control is down
      // safari will fire a keypress if meta or meta+shift is down
      // firefox will fire a keypress if meta or control is down
      if (
        (action === 'keypress' && !event.metaKey && !event.ctrlKey) ||
        modifiersMatch(modifiers, callback.modifiers)
      ) {
        // when you bind a combination or sequence a second time it
        // should overwrite the first one.  if a sequenceName or
        // combination is specified in this call it does just that
        //
        // @todo make deleting its own method?
        let deleteCombo = !sequenceName && callback.combo === combination;
        let deleteSequence = sequenceName && callback.seq === sequenceName && callback.level === level;
        if (deleteCombo || deleteSequence) {
          this._callbacks[character].splice(i, 1);
        }

        matches.push(callback);
      }
    }

    return matches;
  };

  /**
   * actually calls the callback function
   *
   * if your callback function returns false this will use the jquery
   * convention - prevent default and stop propogation on the event
   *
   * @param combo Is the key binding that triggered this callback. When a sequence is triggered, this is the whole sequence. Otherwise, it's the intermediate keys
   * @param sequence Is the 'parent sequence' of the combo. When the whole sequence is triggered, this is undefined.
   */
  private _fireCallback = (callback: Function, e: KeyboardEvent, combo: string, sequence?: string) => {
    // if this event should not happen stop here
    const target = e.target || e.srcElement;
    if (target && target instanceof HTMLElement && this.stopCallback(e, target, combo, sequence)) {
      return;
    }

    if (callback(e, combo) === false) {
      preventDefault(e);
      stopPropagation(e);
    }
  };

  /**
   * handles a character key event
   */
  private _handleKey = (character: string, modifiers: string[], e: KeyboardEvent) => {
    let callbacks = this._getMatches(character, modifiers, e);
    let i;
    let doNotReset: Record<string, number> = {};
    let maxLevel = 0;
    let processedSequenceCallback = false;

    // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
    for (i = 0; i < callbacks.length; ++i) {
      if (callbacks[i].seq) {
        maxLevel = Math.max(maxLevel, callbacks[i].level ?? 0);
      }
    }

    // loop through matching callbacks for this key event
    for (i = 0; i < callbacks.length; ++i) {
      // fire for all sequence callbacks
      // this is because if for example you have multiple sequences
      // bound such as "g i" and "g t" they both need to fire the
      // callback for matching g cause otherwise you can only ever
      // match the first one
      const seq = callbacks[i].seq;
      if (seq) {
        // only fire callbacks for the maxLevel to prevent
        // subsequences from also firing
        //
        // for example 'a option b' should not cause 'option b' to fire
        // even though 'option b' is part of the other sequence
        //
        // any sequences that do not match here will be discarded
        // below by the _resetSequences call
        if (callbacks[i].level !== maxLevel) {
          continue;
        }

        processedSequenceCallback = true;

        // keep a list of which sequences were matches for later
        doNotReset[seq] = 1;
        this._fireCallback(callbacks[i].callback, e, callbacks[i].combo, seq);

        // When matching a callback, don't reset other callbacks that starts with this prefix
        // This allows chaining of multiple shortcuts that share a prefix. e.g. if we have
        // `t left` and `t right`, allow user to hit `t left`, `right` without resetting the sequence
        const suffixPrefixIndex = seq.lastIndexOf(character);
        const sequencePrefix = seq.slice(0, suffixPrefixIndex);
        for (const [seq, level] of Object.entries(this._sequenceLevels)) {
          if (level > 0 && seq.startsWith(sequencePrefix)) {
            doNotReset[seq] = 1;
          }
        }

        continue;
      }

      // if there were no sequence matches but we are still here
      // that means this is a regular match so we should fire that
      if (!processedSequenceCallback) {
        this._fireCallback(callbacks[i].callback, e, callbacks[i].combo);
      }
    }

    // Don't reset a sequence if this character is the start of a sequence that has already progressed.
    // This allows `t left` to be hit immediately after a `t right`
    for (const callback of this._callbacks[character] ?? []) {
      if (callback.action === e.type && callback.seq && callback.level === 0) {
        doNotReset[callback.seq] = 1;
      }
    }

    // if the key you pressed matches the type of sequence without
    // being a modifier (ie "keyup" or "keypress") then we should
    // reset all sequences that were not matched by this event
    //
    // this is so, for example, if you have the sequence "h a t" and you
    // type "h e a r t" it does not match.  in this case the "e" will
    // cause the sequence to reset
    //
    // modifier keys are ignored because you can have a sequence
    // that contains modifiers such as "enter ctrl+space" and in most
    // cases the modifier key will be pressed before the next key
    //
    // also if you have a sequence such as "ctrl+b a" then pressing the
    // "b" key will trigger a "keypress" and a "keydown"
    //
    // the "keydown" is expected when there is a modifier, but the
    // "keypress" ends up matching the _nextExpectedAction since it occurs
    // after and that causes the sequence to reset
    //
    // we ignore keypresses in a sequence that directly follow a keydown
    // for the same character
    let ignoreThisKeypress = e.type === 'keypress' && this._ignoreNextKeypress;
    if (e.type === this._nextExpectedAction && !isModifier(character) && !ignoreThisKeypress) {
      this._resetSequences(doNotReset);
    }

    this._ignoreNextKeypress = processedSequenceCallback && e.type === 'keydown';
  };

  /**
   * handles a keydown event
   */
  private _handleKeyEvent = (rawEvent: Event) => {
    if (!(rawEvent instanceof KeyboardEvent)) {
      throw new Error("Didn't get a KeyboardEvent");
    }
    const event: KeyboardEvent = rawEvent;

    // Don't trigger shortcuts when a key is just held down
    if (event.repeat) {
      return;
    }

    // normalize e.which for key events
    // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
    if (typeof event.which !== 'number') {
      /// @ts-expect-error - TODO: determine what to do with this compat
      event.which = event.keyCode;
    }

    let character = characterFromEvent(event);

    // no character found then stop
    if (!character) {
      return;
    }

    // need to use === for the character check because the character can be 0
    if (event.type === 'keyup' && this._ignoreNextKeyup === character) {
      this._ignoreNextKeyup = false;
      return;
    }

    this.handleKey(character, eventModifiers(event), event);
  };

  /**
   * called to set a 1 second timeout on the specified sequence
   *
   * this is so after each key press in the sequence you have 1 second
   * to press the next key before you have to start over
   */
  private _resetSequenceTimer = () => {
    clearTimeout(this._resetTimer);
    this._resetTimer = setTimeout(this._resetSequences, 1000);
  };

  /**
   * binds a key sequence to an event
   */
  private _bindSequence = (combo: string, keys: string[], callback: MousetrapCallback, action?: string): void => {
    // start off by adding a sequence level record for this combination
    // and setting the level to 0
    this._sequenceLevels[combo] = 0;

    /**
     * callback to increase the sequence level for this sequence and reset
     * all other sequences that were active
     */
    const _increaseSequence = (nextAction: string): MousetrapCallback => {
      return () => {
        this._nextExpectedAction = nextAction;
        ++this._sequenceLevels[combo];
        this._resetSequenceTimer();
      };
    };

    /**
     * wraps the specified callback inside of another function in order
     * to reset all sequence counters as soon as this sequence is done
     */
    const _callbackAndReset = (e: KeyboardEvent): void => {
      this._fireCallback(callback, e, combo);

      // we should ignore the next key up if the action is key down
      // or keypress.  this is so if you finish a sequence and
      // release the key the final key will not trigger a keyup
      if (action !== 'keyup') {
        this._ignoreNextKeyup = characterFromEvent(e);
      }

      // Reset the sequence timer and allow for this shortcut to be
      // triggered again just by repeating the last key
      this._resetSequenceTimer();
    };

    // loop through keys one at a time and bind the appropriate callback
    // function.  for any key leading up to the final one it should
    // increase the sequence. after the final, it should reset all sequences
    //
    // if an action is specified in the original bind call then that will
    // be used throughout.  otherwise we will pass the action that the
    // next key in the sequence should match.  this allows a sequence
    // to mix and match keypress and keydown events depending on which
    // ones are better suited to the key provided
    for (let i = 0; i < keys.length; ++i) {
      let isFinal = i + 1 === keys.length;
      let wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || getKeyInfo(keys[i + 1]).action);
      this._bindSingle(keys[i], wrappedCallback, action, combo, i);
    }
  };

  /**
   * binds a single keyboard combination
   */
  private _bindSingle = (
    combination: string,
    callback: MousetrapCallback,
    action?: string,
    sequenceName?: string,
    level?: number
  ): void => {
    // store a direct mapped reference for use with Mousetrap.trigger
    this._directMap[combination + ':' + action] = callback;

    // make sure multiple spaces in a row become a single space
    combination = combination.replace(/\s+/g, ' ');

    let sequence = combination.split(' ');
    let info;

    // if this pattern is a sequence of keys then run through this method
    // to reprocess each pattern one key at a time
    if (sequence.length > 1) {
      this._bindSequence(combination, sequence, callback, action);
      return;
    }

    info = getKeyInfo(combination, action);

    // make sure to initialize array if this is the first time
    // a callback is added for this key
    this._callbacks[info.key] = this._callbacks[info.key] || [];

    // remove an existing match if there is one
    const eventLike = { type: info.action, metaKey: false, ctrlKey: false };
    this._getMatches(info.key, info.modifiers, eventLike, sequenceName, combination, level);

    const callbackInfo: CallbackInfo = {
      callback: callback,
      modifiers: info.modifiers,
      action: info.action,
      seq: sequenceName,
      level: level,
      combo: combination,
    };

    // add this call back to the array
    // if it is a sequence put it at the beginning
    // if not put it at the end
    //
    // this is important because the way these are processed expects
    // the sequence ones to come first
    this._callbacks[info.key][sequenceName ? 'unshift' : 'push'](callbackInfo);
  };

  /**
   * binds multiple combinations to the same callback
   */
  private _bindMultiple = (combinations: string[], callback: MousetrapCallback, action: string | undefined): void => {
    for (let i = 0; i < combinations.length; ++i) {
      this._bindSingle(combinations[i], callback, action);
    }
  };

  /**
   * binds an event to mousetrap
   *
   * can be a single key, a combination of keys separated with +,
   * an array of keys, or a sequence of keys separated by spaces
   *
   * be sure to list the modifier keys first to make sure that the
   * correct key ends up getting bound (the last key in the pattern)
   */
  bind = (keys: string | string[], callback: MousetrapCallback, action?: string) => {
    let self = this;
    keys = keys instanceof Array ? keys : [keys];
    this._bindMultiple(keys, callback, action);
    return self;
  };

  /**
   * unbinds an event to mousetrap
   *
   * the unbinding sets the callback function of the specified key combo
   * to an empty function and deletes the corresponding key in the
   * _directMap dict.
   *
   * TODO: actually remove this from the _callbacks dictionary instead
   * of binding an empty function
   *
   * the keycombo+action has to be exactly the same as
   * it was defined in the bind method
   */
  unbind = (keys: string | string[], action?: string) => {
    return this.bind(keys, function () {}, action);
  };

  // From bind-global plugin
  // https://github.com/Elvynia/mousetrap-global-bind/blob/master/mousetrap-global-bind.js#L28
  bindGlobal = (keys: string | string[], callback: MousetrapCallback, action?: string) => {
    this.bind(keys, callback, action);

    if (keys instanceof Array) {
      for (let i = 0; i < keys.length; i++) {
        this._globalCallbacks[keys[i]] = true;
      }
      return;
    }

    this._globalCallbacks[keys] = true;
  };

  // From bind-global plugin
  // https://github.com/Elvynia/mousetrap-global-bind/blob/master/mousetrap-global-bind.js#L42
  unbindGlobal = (keys: string | string[], action?: string) => {
    this.unbind(keys, action);

    if (keys instanceof Array) {
      for (let i = 0; i < keys.length; i++) {
        this._globalCallbacks[keys[i]] = false;
      }
      return;
    }

    this._globalCallbacks[keys] = false;
  };

  /**
   * triggers an event that has already been bound
   */
  trigger = (keys: string, action: string | undefined) => {
    let self = this;
    if (self._directMap[keys + ':' + action]) {
      self._directMap[keys + ':' + action]({}, keys);
    }
    return self;
  };

  /**
   * resets the library back to its initial state.  this is useful
   * if you want to clear out the current keyboard shortcuts and bind
   * new ones - for example if you switch to another page
   */
  reset = () => {
    this._callbacks = {};
    this._directMap = {};
    return this;
  };

  /**
   * should we stop this event before firing off callbacks
   */
  stopCallback = (e: Event, element: HTMLElement, combo: string, sequence?: string): boolean => {
    // From global bind plugin https://github.com/Elvynia/mousetrap-global-bind/blob/master/mousetrap-global-bind.js
    if (this._globalCallbacks[combo] || (sequence && this._globalCallbacks[sequence])) {
      return false;
    }

    // if the element has the class "mousetrap" then no need to stop
    if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
      return false;
    }

    if (belongsTo(element, this.target)) {
      return false;
    }

    // Events originating from a shadow DOM are re-targetted and `e.target` is the shadow host,
    // not the initial event target in the shadow tree. Note that not all events cross the
    // shadow boundary.
    // For shadow trees with `mode: 'open'`, the initial event target is the first element in
    // the event’s composed path. For shadow trees with `mode: 'closed'`, the initial event
    // target cannot be obtained.
    if ('composedPath' in e && typeof e.composedPath === 'function') {
      // For open shadow trees, update `element` so that the following check works.
      let initialEventTarget = e.composedPath()[0];
      if (initialEventTarget !== e.target && initialEventTarget instanceof HTMLElement) {
        element = initialEventTarget;
      }
    }

    // stop for input, select, and textarea
    return Boolean(
      element.tagName === 'INPUT' ||
        element.tagName === 'SELECT' ||
        element.tagName === 'TEXTAREA' ||
        ('isContentEditable' in element && element.isContentEditable)
    );
  };

  /**
   * exposes _handleKey publicly so it can be overwritten by extensions
   */
  handleKey: typeof this._handleKey = (...args) => {
    return this._handleKey(...args);
  };

  /**
   * allow custom key mappings
   */
  addKeycodes = (object: Record<string, string>) => {
    for (let key in object) {
      if (object.hasOwnProperty(key)) {
        MAP[key] = object[key];
      }
    }
    REVERSE_MAP = null;
  };
}
