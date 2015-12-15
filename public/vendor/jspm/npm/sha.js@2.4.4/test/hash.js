/* */ 
(function(Buffer) {
  var hexpp = require('../hexpp').defaults({bigendian: false});
  var tape = require('tape');
  var Hash = require('../hash');
  var hex = '0A1B2C3D4E5F6G7H';
  function equal(t, a, b) {
    t.equal(a.length, b.length);
    for (var i = 0; i < a.length; i++) {
      t.equal(a[i], b[i]);
    }
  }
  var hexBuf = new Buffer([48, 65, 49, 66, 50, 67, 51, 68, 52, 69, 53, 70, 54, 71, 55, 72]);
  var count16 = {
    strings: ['0A1B2C3D4E5F6G7H'],
    buffers: [hexBuf, new Buffer([128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128])]
  };
  var empty = {
    strings: [''],
    buffers: [new Buffer([128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])]
  };
  var multi = {
    strings: ['abcd', 'efhijk', 'lmnopq'],
    buffers: [new Buffer('abcdefhijklmnopq', 'ascii'), new Buffer([128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128])]
  };
  var long = {
    strings: [hex + hex],
    buffers: [hexBuf, hexBuf, new Buffer([128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0])]
  };
  function makeTest(name, data) {
    tape(name, function(t) {
      var h = new Hash(16, 8);
      var hash = new Buffer(20);
      var n = 2;
      var expected = data.buffers.slice();
      h._update = function(block) {
        var e = expected.shift();
        console.log('---block---');
        console.log(hexpp(block), block.length);
        console.log('---e---');
        console.log(hexpp(e), block.length);
        console.log(block);
        equal(t, block, e);
        if (n < 0) {
          throw new Error('expecting only 2 calls to _update');
        }
        return hash;
      };
      data.strings.forEach(function(string) {
        h.update(string, 'ascii');
      });
      equal(t, h.digest(), hash);
      t.end();
    });
  }
  makeTest('Hash#update 1 in 1', count16);
  makeTest('empty Hash#update', empty);
  makeTest('Hash#update 1 in 3', multi);
  makeTest('Hash#update 2 in 1', long);
})(require('buffer').Buffer);
