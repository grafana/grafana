define([
  'angular',
  'lodash',
  '../core_module',
],
function (angular, _, coreModule) {
  'use strict';

  // This service was based on OpenJS library available in BSD License
  // http://www.openjs.com/scripts/events/keyboard_shortcuts/index.php
  coreModule.factory('keyboardManager', ['$window', '$timeout', function ($window, $timeout) {
    var keyboardManagerService = {};

    var defaultOpt = {
      'type':             'keydown',
      'propagate':        false,
      'inputDisabled':    false,
      'target':           $window.document,
      'keyCode':          false
    };
    // Store all keyboard combination shortcuts
    keyboardManagerService.keyboardEvent = {};
    // Add a new keyboard combination shortcut
    keyboardManagerService.bind = function (label, callback, opt) {
      var fct, elt, code, k;
      // Initialize opt object
      opt   = angular.extend({}, defaultOpt, opt);
      label = label.toLowerCase();
      elt   = opt.target;

      if (typeof opt.target === 'string') {
        elt = document.getElementById(opt.target);
      }

      fct = function (e) {
        e = e || $window.event;

        // Disable event handler when focus input and textarea
        if (opt['inputDisabled']) {
          var elt;
          if (e.target) {
            elt = e.target;
          }
          else if (e.srcElement) {
            elt = e.srcElement;
          }

          if (elt.nodeType === 3) {
            elt = elt.parentNode;
          }

          if (elt.tagName === 'INPUT' || elt.tagName === 'TEXTAREA') {
            return;
          }
        }

        // Find out which key is pressed
        if (e.keyCode) {
          code = e.keyCode;
        }
        else if (e.which) {
          code = e.which;
        }

        var character = String.fromCharCode(code).toLowerCase();

        if (code === 188) {
          character = ","; // If the user presses , when the type is onkeydown
        }
        if (code === 190) {
          character = "."; // If the user presses , when the type is onkeydown
        }

        var keys = label.split("+");
        // Key Pressed - counts the number of valid keypresses - if it is same as the number of keys, the shortcut function is invoked
        var kp = 0;
        // Work around for stupid Shift key bug created by using lowercase - as a result the shift+num combination was broken
        var shift_nums = {
          "`": "~",
          "1": "!",
          "2": "@",
          "3": "#",
          "4": "$",
          "5": "%",
          "6": "^",
          "7": "&",
          "8": "*",
          "9": "(",
          "0": ")",
          "-": "_",
          "=": "+",
          ";": ":",
          "'": "\"",
          ",": "<",
          ".": ">",
          "/": "?",
          "»": "?",
          "«": "?",
          "¿": "?",
          "\\": "|"
        };
        // Special Keys - and their codes
        var special_keys = {
          'esc': 27,
          'escape': 27,
          'tab': 9,
          'space': 32,
          'return': 13,
          'enter': 13,
          'backspace': 8,

          'scrolllock': 145,
          'scroll_lock': 145,
          'scroll': 145,
          'capslock': 20,
          'caps_lock': 20,
          'caps': 20,
          'numlock': 144,
          'num_lock': 144,
          'num': 144,

          'pause': 19,
          'break': 19,

          'insert': 45,
          'home': 36,
          'delete': 46,
          'end': 35,

          'pageup': 33,
          'page_up': 33,
          'pu': 33,

          'pagedown': 34,
          'page_down': 34,
          'pd': 34,

          'left': 37,
          'up': 38,
          'right': 39,
          'down': 40,

          'f1': 112,
          'f2': 113,
          'f3': 114,
          'f4': 115,
          'f5': 116,
          'f6': 117,
          'f7': 118,
          'f8': 119,
          'f9': 120,
          'f10': 121,
          'f11': 122,
          'f12': 123
        };
        // Some modifiers key
        var modifiers = {
          shift: {
            wanted:   false,
            pressed:  e.shiftKey ? true : false
          },
          ctrl : {
            wanted:   false,
            pressed:  e.ctrlKey ? true : false
          },
          alt  : {
            wanted:   false,
            pressed:  e.altKey ? true : false
          },
          meta : { //Meta is Mac specific
            wanted:   false,
            pressed:  e.metaKey ? true : false
          }
        };
        // Foreach keys in label (split on +)
        for (var i = 0, l = keys.length; k = keys[i], i < l; i++) {
          switch (k) {
          case 'ctrl':
          case 'control':
            kp++;
            modifiers.ctrl.wanted = true;
            break;
          case 'shift':
          case 'alt':
          case 'meta':
            kp++;
            modifiers[k].wanted = true;
            break;
          }

          if (k.length > 1) { // If it is a special key
            if (special_keys[k] === code) {
              kp++;
            }
          } else if (opt['keyCode']) { // If a specific key is set into the config
            if (opt['keyCode'] === code) {
              kp++;
            }
          } else { // The special keys did not match
            if (character === k) {
              kp++;
            }
            else {
              if (shift_nums[character] && e.shiftKey) { // Stupid Shift key bug created by using lowercase
                character = shift_nums[character];
                if (character === k) {
                  kp++;
                }
              }
            }
          }
        }

        if (kp === keys.length &&
          modifiers.ctrl.pressed === modifiers.ctrl.wanted &&
          modifiers.shift.pressed === modifiers.shift.wanted &&
          modifiers.alt.pressed === modifiers.alt.wanted &&
          modifiers.meta.pressed === modifiers.meta.wanted) {
          $timeout(function() {
            callback(e);
          }, 1);

          if (!opt['propagate']) { // Stop the event
            // e.cancelBubble is supported by IE - this will kill the bubbling process.
            e.cancelBubble = true;
            e.returnValue = false;

            // e.stopPropagation works in Firefox.
            if (e.stopPropagation) {
              e.stopPropagation();
              e.preventDefault();
            }
            return false;
          }
        }

      };
      // Store shortcut
      keyboardManagerService.keyboardEvent[label] = {
        'callback': fct,
        'target':   elt,
        'event':    opt['type']
      };
      //Attach the function with the event
      if (elt.addEventListener) {
        elt.addEventListener(opt['type'], fct, false);
      }
      else if (elt.attachEvent) {
        elt.attachEvent('on' + opt['type'], fct);
      }
      else {
        elt['on' + opt['type']] = fct;
      }
    };

    keyboardManagerService.unbindAll = function() {
      _.each(keyboardManagerService.keyboardEvent, function(value, key) {
        keyboardManagerService.unbind(key);
      });
    };

    // Remove the shortcut - just specify the shortcut and I will remove the binding
    keyboardManagerService.unbind = function (label) {
      label = label.toLowerCase();

      var binding = keyboardManagerService.keyboardEvent[label];
      delete(keyboardManagerService.keyboardEvent[label]);

      if (!binding) {
        return;
      }

      var type    = binding['event'],
      elt     = binding['target'],
      callback  = binding['callback'];

      if (elt.detachEvent) {
        elt.detachEvent('on' + type, callback);
      }
      else if (elt.removeEventListener) {
        elt.removeEventListener(type, callback, false);
      }
      else {
        elt['on' + type] = false;
      }
    };
    //
    return keyboardManagerService;
  }]);

});
