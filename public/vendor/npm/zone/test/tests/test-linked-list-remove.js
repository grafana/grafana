require('../common.js');

test.expect(3);

var LinkedList = require('../../lib/linked-list.js');
var l = new LinkedList('test');

for (var i = 0; i < 10; i++) {
  l.push({value: i});
}

x = l.head();
l.remove(x);
test.equal(l.head().value, 1);

x = l.tail();
l.remove(x);
test.equal(l.tail().value, 8);

i = l.iterator();
i.next();
i.next();
i.next();
x = i.next();
l.remove(x);

i = l.iterator();
i.next();
i.next();
i.next();
x = i.next();
test.equal(x.value, 5);
test.done();
