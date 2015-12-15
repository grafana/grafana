/* */ 
module.exports = !require('./$.fails')(function() {
  return Object.defineProperty({}, 'a', {get: function() {
      return 7;
    }}).a != 7;
});
