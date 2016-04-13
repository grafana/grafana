define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('prometheusFuncEditor', function($compile) {

      var exprTemplate = '<input type="text" class="gf-form-input"' +
                         'spellcheck="false" placeholder="query expression" data-min-length=0 data-items=100></input>';

      return {
        restrict: 'A',
        link: function postLink($scope, elem) {
          var ctrl = $scope.ctrl;

          function inputBlur() {
            /* jshint validthis:true */
            var $input = $(this);
            ctrl.target.expr = $input.val();
            ctrl.refreshMetricData();
          }

          function inputKeyPress(e) {
            /* jshint validthis:true */
            if (e.which === 13) {
              inputBlur.call(this);
            }
          }

          // Returns true if the character at "pos" in the expression string "str" looks
          // like it could be a metric name (if it's not in a string, a label matchers
          // section, or a range specification).
          function isPotentialMetric(str, pos) {
            var quote = null;
            var inMatchersOrRange = false;
            var inOnOrIgnoringOrByOrWithoutOrGroup = false;

            for (var i = 0; i < pos; i++) {
              var ch = str[i];

              // Skip over escaped characters (quotes or otherwise) in strings.
              if (quote !== null && ch === "\\") {
                i += 1;
                continue;
              }

              // Track if we are entering or leaving a string.
              switch (ch) {
              case quote:
                quote = null;
                break;
              case '"':
              case "'":
                quote = ch;
                break;
              }

              // Ignore curly braces and square brackets in strings.
              if (quote) {
                continue;
              }

              // Track whether we are in curly braces (label matchers).
              switch (ch) {
              case "{":
              case "[":
                inMatchersOrRange = true;
                break;
              case "}":
              case "]":
                inMatchersOrRange = false;
                break;
              }

              if (inMatchersOrRange) {
                continue;
              }

              if (inOnOrIgnoringOrByOrWithoutOrGroup && ch === ')') {
                inOnOrIgnoringOrByOrWithoutOrGroup = false;
                continue;
              }

              var onIgnoringByWithoutGroup = [' on', 'ignoring', ' by', ' without', ' group_left', ' group_right'];
              for (var n = 0; n < onIgnoringByWithoutGroup.length; n++) {
                var candidate = onIgnoringByWithoutGroup[n];
                if (str.slice(i, i + candidate.length) === candidate) {
                  if ([' ', '('].includes(str[i + candidate.length])) {
                    i = i + candidate.length;
                    inOnOrIgnoringOrByOrWithoutOrGroup = true;
                    break;
                  }
                }
              }
            }

            return !inMatchersOrRange && !inOnOrIgnoringOrByOrWithoutOrGroup && quote === null;
          }

          // Returns the current word under the cursor position in $input.
          function currentWord($input) {
            var wordRE = new RegExp("[a-zA-Z0-9:_]");
            var pos = $input.prop("selectionStart");
            var str = $input.val();
            var len = str.length;
            var start = pos;
            var end = pos;

            while (start > 0 && str[start-1].match(wordRE)) {
              start--;
            }
            while (end < len && str[end].match(wordRE)) {
              end++;
            }

            return {
              start: start,
              end: end,
              word: $input.val().substring(start, end)
            };
          }

          function addTypeahead($input) {
            $input.attr('placeholder', 'Loading auto-suggestions ...');
            ctrl.datasource.performSuggestQuery('')
            .then(function(allMetricName) {
              $input.attr('placeholder', 'query expression');
              // For the typeahead autocompletion, we need to remember where to put
              // the cursor after inserting an autocompleted word (we want to put it
              // after that word, not at the end of the entire input string).
              var afterUpdatePos = null;

              $input.typeahead({
                // Needs to return true for autocomplete items that should be matched
                // by the current input.
                matcher: function(item) {
                  var cw = currentWord($input);
                  if (cw.word.length !== 0 &&
                    item.toLowerCase().indexOf(cw.word.toLowerCase()) > -1 &&
                    isPotentialMetric($input.val(), cw.start)) {
                    return true;
                  }
                  return false;
                },
                // Returns the entire string to which the input field should be set
                // upon selecting an item from the autocomplete list.
                updater: function(item) {
                  var str = $input.val();
                  var cw = currentWord($input);
                  afterUpdatePos = cw.start + item.length;
                  setTimeout(function() {
                    // after input update, move cursor correct place
                    $input.prop("selectionStart", afterUpdatePos);
                    $input.prop("selectionEnd", afterUpdatePos);
                  }, 0);
                  return str.substring(0, cw.start) + item + str.substring(cw.end, str.length);
                },
                source: allMetricName,
                items: 30
              });
            })
            .catch(function() {
              $input.attr('placeholder', 'Failed to load auto-suggestions');
            });
          }

          function addElementsAndCompile() {
            var $input = $(exprTemplate);
            $input.val(ctrl.target.expr);
            $input.blur(inputBlur);
            $input.keypress(inputKeyPress);
            $input.appendTo(elem);
            addTypeahead($input);
            $compile(elem.contents())($scope);
          }

          function relink() {
            elem.children().remove();
            addElementsAndCompile();
          }

          relink();
        }
      };

    });

});
