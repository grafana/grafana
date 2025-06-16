const elementPositions = (_chai) => {
  function assertIsHigherThan(el) {
    this.assert(
      this._obj.offset().top < el.offset().top,
      'expected #{this} to be above target',
      'expected #{this} to not be above target',
      this._obj
    );
  }

  function assertIsLowerThan(el) {
    this.assert(
      this._obj.offset().top > el.offset().top,
      'expected #{this} to be below target',
      'expected #{this} to not be below target',
      this._obj
    );
  }

  function assertIsLeftOf(el) {
    this.assert(
      this._obj.offset().left < el.offset().left,
      'expected #{this} to be left of target',
      'expected #{this} to not be left of target',
      this._obj
    );
  }

  function assertIsRightOf(el) {
    this.assert(
      this._obj.offset().left > el.offset().left,
      'expected #{this} to be right of target',
      'expected #{this} to not be right of target',
      this._obj
    );
  }

  // Would prefer 'above' and 'below', but those already exist for numeric comparisons. Not sure they can be overloaded.
  _chai.Assertion.addMethod('higherThan', assertIsHigherThan);
  _chai.Assertion.addMethod('lowerThan', assertIsLowerThan);
  _chai.Assertion.addMethod('leftOf', assertIsLeftOf);
  _chai.Assertion.addMethod('rightOf', assertIsRightOf);
};

chai.use(elementPositions);
