;(function(window) {
  'use strict';

  /** The base path of the lodash builds. */
  var basePath = '../';

  /** The lodash build to load. */
  var build = (build = /build=([^&]+)/.exec(location.search)) && decodeURIComponent(build[1]);

  /** The other library to load. */
  var other = (other = /other=([^&]+)/.exec(location.search)) && decodeURIComponent(other[1]);

  /** The `ui` object. */
  var ui = {};

  /*--------------------------------------------------------------------------*/

  // Initialize controls.
  addEventListener('load', function() {
    function eventHandler(event) {
      var buildIndex = buildList.selectedIndex,
          otherIndex = otherList.selectedIndex,
          search = location.search.replace(/^\?|&?(?:build|other)=[^&]*&?/g, '');

      if (event.stopPropagation) {
        event.stopPropagation();
      } else {
        event.cancelBubble = true;
      }
      location.href =
        location.href.split('?')[0] + '?' +
        (search ? search + '&' : '') +
        'build=' + (buildIndex < 0 ? build : buildList[buildIndex].value) + '&' +
        'other=' + (otherIndex < 0 ? other : otherList[otherIndex].value);
    }

    var span1 = document.createElement('span');
    span1.style.cssText = 'float:right';
    span1.innerHTML =
      '<label for="perf-build">Build: </label>' +
      '<select id="perf-build">' +
      '<option value="lodash">lodash</option>' +
      '</select>';

    var span2 = document.createElement('span');
    span2.style.cssText = 'float:right';
    span2.innerHTML =
      '<label for="perf-other">Other Library: </label>' +
      '<select id="perf-other">' +
      '<option value="underscore-dev">Underscore (development)</option>' +
      '<option value="underscore">Underscore (production)</option>' +
      '<option value="lodash">lodash</option>' +
      '</select>';

    var buildList = span1.lastChild,
        otherList = span2.lastChild,
        toolbar = document.getElementById('perf-toolbar');

    toolbar.appendChild(span2);
    toolbar.appendChild(span1);

    buildList.selectedIndex = (function() {
      switch (build) {
        case 'lodash':
        case null:                return 0;
      }
      return -1;
    }());

    otherList.selectedIndex = (function() {
      switch (other) {
        case 'underscore-dev':    return 0;
        case 'lodash':            return 2;
        case 'underscore':
        case null:                return 1;
      }
      return -1;
    }());

    buildList.addEventListener('change', eventHandler);
    otherList.addEventListener('change', eventHandler);
  });

  // The lodash build file path.
  ui.buildPath = (function() {
    var result;
    switch (build) {
      case null:                build  = 'lodash';
      case 'lodash':            result = 'dist/lodash.min.js'; break;
      default:                  return build;
    }
    return basePath + result;
  }());

  // The other library file path.
  ui.otherPath = (function() {
    var result;
    switch (other) {
      case 'lodash':            result = 'dist/lodash.min.js'; break;
      case 'underscore-dev':    result = 'vendor/underscore/underscore.js'; break;
      case null:                other  = 'underscore';
      case 'underscore':        result = 'vendor/underscore/underscore-min.js'; break;
      default:                  return other;
    }
    return basePath + result;
  }());

  ui.urlParams = { 'build': build, 'other': other };

  window.ui = ui;

}(this));
