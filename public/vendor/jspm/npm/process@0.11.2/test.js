/* */ 
var assert = require('assert');
var ourProcess = require('./browser');
describe('test against process', function() {
  test(process);
});
if (!process.browser) {
  describe('test against our shim', function() {
    test(ourProcess);
  });
}
function test(ourProcess) {
  describe('test arguments', function(t) {
    it('works', function(done) {
      var order = 0;
      ourProcess.nextTick(function(num) {
        assert.equal(num, order++, 'first one works');
        ourProcess.nextTick(function(num) {
          assert.equal(num, order++, 'recursive one is 4th');
        }, 3);
      }, 0);
      ourProcess.nextTick(function(num) {
        assert.equal(num, order++, 'second one starts');
        ourProcess.nextTick(function(num) {
          assert.equal(num, order++, 'this is third');
          ourProcess.nextTick(function(num) {
            assert.equal(num, order++, 'this is last');
            done();
          }, 5);
        }, 4);
      }, 1);
      ourProcess.nextTick(function(num) {
        assert.equal(num, order++, '3rd schedualed happens after the error');
      }, 2);
    });
  });
  describe('test errors', function(t) {
    it('works', function(done) {
      var order = 0;
      process.removeAllListeners('uncaughtException');
      process.once('uncaughtException', function(err) {
        assert.equal(2, order++, 'error is third');
        ourProcess.nextTick(function() {
          assert.equal(5, order++, 'schedualed in error is last');
          done();
        });
      });
      ourProcess.nextTick(function() {
        assert.equal(0, order++, 'first one works');
        ourProcess.nextTick(function() {
          assert.equal(4, order++, 'recursive one is 4th');
        });
      });
      ourProcess.nextTick(function() {
        assert.equal(1, order++, 'second one starts');
        throw (new Error('an error is thrown'));
      });
      ourProcess.nextTick(function() {
        assert.equal(3, order++, '3rd schedualed happens after the error');
      });
    });
  });
}
