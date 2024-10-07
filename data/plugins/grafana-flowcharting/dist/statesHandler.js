"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _state_class = _interopRequireDefault(require("./state_class"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var StateHandler = function () {
  function StateHandler(xgraph, ctrl) {
    _classCallCheck(this, StateHandler);

    u.log(1, 'StateHandler.constructor()');
    this.states = [];
    this.ctrl = ctrl;
    this.templateSrv = this.ctrl.templateSrv;
    this.xgraph = xgraph;
    this.initStates(this.xgraph, ctrl.rulesHandler.getRules());
  }

  _createClass(StateHandler, [{
    key: "initStates",
    value: function initStates(xgraph, rules) {
      var _this = this;

      u.log(1, 'StateHandler.initStates()');
      this.xgraph = xgraph;
      this.states = [];
      var mxcells = xgraph.getMxCells();

      _.each(mxcells, function (mxcell) {
        _this.addState(mxcell);
      });
    }
  }, {
    key: "getStatesForRule",
    value: function getStatesForRule(rule) {
      u.log(1, 'StateHandler.getStatesForRule()');
      var result = [];
      var name = null;
      var xgraph = this.xgraph;
      this.states.forEach(function (state) {
        var mxcell = state.mxcell;
        var found = false;
        name = xgraph.getValuePropOfMxCell(rule.data.shapeProp, mxcell);

        if (rule.matchShape(name)) {
          result.push(state);
          found = true;
        }

        if (!found) {
          name = xgraph.getValuePropOfMxCell(rule.data.textProp, mxcell);

          if (rule.matchText(name)) {
            result.push(state);
            found = true;
          }
        }

        if (!found) {
          name = xgraph.getValuePropOfMxCell(rule.data.linkProp, mxcell);

          if (rule.matchLink(name)) {
            result.push(state);
            found = true;
          }
        }
      });
      return result;
    }
  }, {
    key: "updateStates",
    value: function updateStates(rules) {
      var _this2 = this;

      u.log(1, 'StateHandler.updateStates()');
      rules.forEach(function (rule) {
        rule.states = _this2.getStatesForRule(rule);
      });
    }
  }, {
    key: "getStates",
    value: function getStates() {
      return this.states;
    }
  }, {
    key: "getState",
    value: function getState(cellId) {
      var foundState = null;

      for (var index = 0; index < this.states.length; index++) {
        var state = this.states[index];

        if (cellId == state.cellId) {
          foundState = state;
          break;
        }
      }

      return foundState;
    }
  }, {
    key: "addState",
    value: function addState(mxcell) {
      var state = this.getState(mxcell.id);

      if (state === null) {
        state = new _state_class["default"](mxcell, this.xgraph, this.ctrl);
        this.states.push(state);
      }

      return state;
    }
  }, {
    key: "countStates",
    value: function countStates() {
      return this.states.length;
    }
  }, {
    key: "countStatesWithLevel",
    value: function countStatesWithLevel(level) {
      var count = 0;
      this.states.forEach(function (state) {
        if (state.getLevel() === level) count += 1;
      });
      return count;
    }
  }, {
    key: "prepare",
    value: function prepare() {
      this.states.forEach(function (state) {
        state.prepare();
      });
    }
  }, {
    key: "setStates",
    value: function setStates(rules, series) {
      var _this3 = this;

      u.log(1, 'StateHandler.setStates()');
      u.log(0, 'StatesHandler.setStates() Rules', rules);
      u.log(0, 'StatesHandler.setStates() Series', series);
      u.log(0, 'StatesHandler.setStates() States', this.states);
      this.prepare();
      rules.forEach(function (rule) {
        if (rule.states === undefined || rule.states.length === 0) rule.states = _this3.getStatesForRule(rule);
        rule.states.forEach(function (state) {
          series.forEach(function (serie) {
            state.setState(rule, serie);
          });
        });
      });
    }
  }, {
    key: "applyStates",
    value: function applyStates() {
      u.log(1, 'StateHandler.applyStates()');
      this.states.forEach(function (state) {
        state.applyState();
      });
    }
  }, {
    key: "async_applyStates",
    value: function async_applyStates() {
      this.applyStates();
    }
  }]);

  return StateHandler;
}();

exports["default"] = StateHandler;
