export default class AngularJSMock {
  service: any;
  controller: any;
  directive: any;

  constructor() {
    this.service = jest.fn();
    this.controller = jest.fn();
    this.directive = jest.fn();
  }

  module() {
    return this;
  }
}

module.exports = AngularJSMock;
