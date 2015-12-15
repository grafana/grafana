/* */ 
"format cjs";
/* global expect, describe, it */

describe('Object.setPrototypeOf(o, p)', function () {
  'use strict';

  it('changes prototype to regular objects', function () {
    var obj = { a: 123 };
    expect(obj).to.be.an.instanceOf(Object);
    // sham requires assignment to work cross browser
    obj = Object.setPrototypeOf(obj, null);
    expect(obj).not.to.be.an.instanceOf(Object);
    expect(obj.a).to.equal(123);
  });

  it('changes prototype to null objects', function () {
    var obj = Object.create(null);
    obj.a = 456;
    expect(obj).not.to.be.an.instanceOf(Object);
    expect(obj.a).to.equal(456);
    // sham requires assignment to work cross browser
    obj = Object.setPrototypeOf(obj, {});
    expect(obj).to.be.an.instanceOf(Object);
    expect(obj.a).to.equal(456);
  });

});
