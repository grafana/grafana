require('../common.js');

test.expect(2);

var http = require('http');
var agent1, agent2, agent3;

agent1 = http.globalAgent;

zone.create(function() {
  agent2 = http.globalAgent;
});

zone.create(function() {
  agent3 = http.globalAgent;
});

test.notStrictEqual(agent1, agent2);
test.notStrictEqual(agent1, agent3);
test.done();
