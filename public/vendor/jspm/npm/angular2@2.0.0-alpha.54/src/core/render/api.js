/* */ 
'use strict';
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var exceptions_1 = require('../../facade/exceptions');
var RenderProtoViewRef = (function() {
  function RenderProtoViewRef() {}
  return RenderProtoViewRef;
})();
exports.RenderProtoViewRef = RenderProtoViewRef;
var RenderFragmentRef = (function() {
  function RenderFragmentRef() {}
  return RenderFragmentRef;
})();
exports.RenderFragmentRef = RenderFragmentRef;
var RenderViewRef = (function() {
  function RenderViewRef() {}
  return RenderViewRef;
})();
exports.RenderViewRef = RenderViewRef;
var RenderTemplateCmd = (function() {
  function RenderTemplateCmd() {}
  return RenderTemplateCmd;
})();
exports.RenderTemplateCmd = RenderTemplateCmd;
var RenderBeginCmd = (function(_super) {
  __extends(RenderBeginCmd, _super);
  function RenderBeginCmd() {
    _super.apply(this, arguments);
  }
  Object.defineProperty(RenderBeginCmd.prototype, "ngContentIndex", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(RenderBeginCmd.prototype, "isBound", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return RenderBeginCmd;
})(RenderTemplateCmd);
exports.RenderBeginCmd = RenderBeginCmd;
var RenderTextCmd = (function(_super) {
  __extends(RenderTextCmd, _super);
  function RenderTextCmd() {
    _super.apply(this, arguments);
  }
  Object.defineProperty(RenderTextCmd.prototype, "value", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return RenderTextCmd;
})(RenderBeginCmd);
exports.RenderTextCmd = RenderTextCmd;
var RenderNgContentCmd = (function(_super) {
  __extends(RenderNgContentCmd, _super);
  function RenderNgContentCmd() {
    _super.apply(this, arguments);
  }
  Object.defineProperty(RenderNgContentCmd.prototype, "index", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(RenderNgContentCmd.prototype, "ngContentIndex", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return RenderNgContentCmd;
})(RenderTemplateCmd);
exports.RenderNgContentCmd = RenderNgContentCmd;
var RenderBeginElementCmd = (function(_super) {
  __extends(RenderBeginElementCmd, _super);
  function RenderBeginElementCmd() {
    _super.apply(this, arguments);
  }
  Object.defineProperty(RenderBeginElementCmd.prototype, "name", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(RenderBeginElementCmd.prototype, "attrNameAndValues", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(RenderBeginElementCmd.prototype, "eventTargetAndNames", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return RenderBeginElementCmd;
})(RenderBeginCmd);
exports.RenderBeginElementCmd = RenderBeginElementCmd;
var RenderBeginComponentCmd = (function(_super) {
  __extends(RenderBeginComponentCmd, _super);
  function RenderBeginComponentCmd() {
    _super.apply(this, arguments);
  }
  Object.defineProperty(RenderBeginComponentCmd.prototype, "templateId", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return RenderBeginComponentCmd;
})(RenderBeginElementCmd);
exports.RenderBeginComponentCmd = RenderBeginComponentCmd;
var RenderEmbeddedTemplateCmd = (function(_super) {
  __extends(RenderEmbeddedTemplateCmd, _super);
  function RenderEmbeddedTemplateCmd() {
    _super.apply(this, arguments);
  }
  Object.defineProperty(RenderEmbeddedTemplateCmd.prototype, "isMerged", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(RenderEmbeddedTemplateCmd.prototype, "children", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  return RenderEmbeddedTemplateCmd;
})(RenderBeginElementCmd);
exports.RenderEmbeddedTemplateCmd = RenderEmbeddedTemplateCmd;
var RenderViewWithFragments = (function() {
  function RenderViewWithFragments(viewRef, fragmentRefs) {
    this.viewRef = viewRef;
    this.fragmentRefs = fragmentRefs;
  }
  return RenderViewWithFragments;
})();
exports.RenderViewWithFragments = RenderViewWithFragments;
var RenderComponentTemplate = (function() {
  function RenderComponentTemplate(id, shortId, encapsulation, commands, styles) {
    this.id = id;
    this.shortId = shortId;
    this.encapsulation = encapsulation;
    this.commands = commands;
    this.styles = styles;
  }
  return RenderComponentTemplate;
})();
exports.RenderComponentTemplate = RenderComponentTemplate;
var Renderer = (function() {
  function Renderer() {}
  return Renderer;
})();
exports.Renderer = Renderer;
