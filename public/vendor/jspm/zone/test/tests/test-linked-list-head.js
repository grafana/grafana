require('../common.js');

test.expect(11);

var LinkedList = require('../../lib/linked-list.js');
var l = new LinkedList('test');

for (var i = 0; i < 10; i++) {
  l.push(i);
}

for (i = 0; i < 10; i++) {
  test.equal(l.head(), i);
  l.shift();
}

test.equal(l.head(), null);
test.done();
