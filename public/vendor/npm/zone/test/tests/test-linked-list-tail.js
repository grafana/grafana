require('../common.js');

test.expect(11);

var LinkedList = require('../../lib/linked-list.js');
var l = new LinkedList('test');

for (var i = 0; i < 10; i++) {
  l.push(i);
}

for (i = 9; i >= 0; i--) {
  test.equal(l.tail(), i);
  l.pop();
}

test.equal(l.tail(), null);
test.done();
