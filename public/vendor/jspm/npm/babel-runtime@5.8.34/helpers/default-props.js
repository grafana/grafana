/* */ 
"use strict";

exports["default"] = function (defaultProps, props) {
  if (defaultProps) {
    for (var propName in defaultProps) {
      if (typeof props[propName] === "undefined") {
        props[propName] = defaultProps[propName];
      }
    }
  }

  return props;
};

exports.__esModule = true;