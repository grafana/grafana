/* global u */
import State from './state_class';

/**
 *States Handler class
 *
 * @export
 * @class StateHandler
 */
export default class StateHandler {
  constructor(xgraph, ctrl) {
    u.log(1, 'StateHandler.constructor()');
    this.states = [];
    this.ctrl = ctrl;
    this.templateSrv = this.ctrl.templateSrv;
    this.xgraph = xgraph;
    this.initStates(this.xgraph, ctrl.rulesHandler.getRules());
  }

  /**
   * Init states
   *
   * @param {XGraph} xgraph
   * @memberof StateHandler
   */
  // initStates(xgraph, rules) {
  //   u.log(1, 'StateHandler.initStates()');
  //   this.xgraph = xgraph;
  //   this.states = [];
  //   this.updateStates(rules);
  // }
  initStates(xgraph,rules) {
    u.log(1, 'StateHandler.initStates()');
    this.xgraph = xgraph;
    this.states = [];
    let mxcells = xgraph.getMxCells();
    _.each(mxcells, mxcell => {
      this.addState(mxcell);
    });
  }

  /**
   *Return states array for a rule
   *
   * @param {Rule} rule - rule mapping
   * @returns {Array<State>}
   * @memberof StateHandler
   */
  getStatesForRule(rule) {
    u.log(1, 'StateHandler.getStatesForRule()');
    let result = [];
    let name = null;
    let xgraph = this.xgraph;
    this.states.forEach(state => {
      let mxcell = state.mxcell;
      let found = false;
      // SHAPES
      name = xgraph.getValuePropOfMxCell(rule.data.shapeProp, mxcell);
      if (rule.matchShape(name)) {
        result.push(state);
        found = true;
      }

      // TEXTS
      if (!found) {
        name = xgraph.getValuePropOfMxCell(rule.data.textProp, mxcell);
        if (rule.matchText(name)) {
          result.push(state);
          found = true;
        }
      }
      // LINKS
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

  /**
   * Update States : Add or remove state in states when rules changed
   *
   * @param {XGraph} xgraph
   * @param {Array<Rule>} rules
   * @memberof StateHandler
   */
  // OLD METHOD : see getStatesForRule
  updateStates(rules) {
    u.log(1, 'StateHandler.updateStates()');
    rules.forEach(rule => {
      rule.states = this.getStatesForRule(rule);
    });
  }

  /**
   * Return array of state
   * @returns {Array} Array of state object
   */
  getStates() {
    return this.states;
  }

  /**
   * Find state by Id
   * @param  {string} cellId - Id of cell
   * @returns {state}
   */
  getState(cellId) {
    let foundState = null;
    for (let index = 0; index < this.states.length; index++) {
      const state = this.states[index];
      if (cellId == state.cellId) {
        foundState = state;
        break;
      }
    }
    return foundState;
  }

  /**
   * Add a state
   *
   * @param {mxCell} mxcell
   * @returns {State} created state
   * @memberof StateHandler
   */
  addState(mxcell) {
    let state = this.getState(mxcell.id);
    if (state === null) {
      state = new State(mxcell, this.xgraph, this.ctrl);
      this.states.push(state);
    }
    return state;
  }

  /**
   * Remove state
   *
   * @param {mxCell} mxcell
   * @memberof StateHandler
   */
  // NOT USED
  // removeState(mxcell) {
  //   this.states = _.without(this.states, mxcell);
  // }

  /**
   * Count number of state
   *
   * @returns {Number}
   * @memberof StateHandler
   */
  countStates() {
    return this.states.length;
  }

  /**
   * Count number of state with level
   *
   * @param {Number} level - 0 for OK | 1 for Warning | 2 for Error
   * @returns {Number}
   * @memberof StateHandler
   */
  countStatesWithLevel(level) {
    let count = 0;
    this.states.forEach(state => {
      if (state.getLevel() === level) count += 1;
    });
    return count;
  }
  /**
   * Restore initial status and prepare states object
   */
  prepare() {
    this.states.forEach(state => {
      state.prepare();
    });
  }

  /**
   * Change states according to rules and datas from grafana
   * @param  {Array<Rule>} rules - Array of Rule object
   * @param  {Array<Serie>} series - Array of serie object
   */
  setStates(rules, series) {
    u.log(1, 'StateHandler.setStates()');
    u.log(0, 'StatesHandler.setStates() Rules', rules);
    u.log(0, 'StatesHandler.setStates() Series', series);
    u.log(0, 'StatesHandler.setStates() States', this.states);
    this.prepare();
    rules.forEach(rule => {
      if (rule.states === undefined || rule.states.length === 0 ) rule.states = this.getStatesForRule(rule);
      rule.states.forEach(state => {
        series.forEach(serie => {
          state.setState(rule, serie);
        });
      });
    });
  }

  /**
   * Apply color and text
   */
  applyStates() {
    u.log(1, 'StateHandler.applyStates()');
    this.states.forEach(state => {
      state.applyState();
    });
  }

  /**
   *Call applyStates asynchronously
   *
   * @memberof StateHandler
   */
  async_applyStates() {
    this.applyStates();
  }
}
