var rounds = 1e7;
var name = '';
var itrLeft = 0;
var start = 0;
var benchFunc = null;

exports.startBenchmark = function(name_, benchFunc_) {
  benchFunc = benchFunc_;
  itrLeft = rounds;
  name = name_;
  start = Date.now();
  benchFunc(next);
};

function next() {
  if (!--itrLeft)
    return done();
  benchFunc(next);
}

function done() {
  var end = Date.now();
  var perSec = rounds / (end - start) * 1000;
  console.log('ops/sec: %d (' + name + ')', perSec);
}
