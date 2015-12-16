
exports.locate = function(load) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve('custom fetch');
    }, 20);      
  });
}

exports.fetch = function(load) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve(load.address);
    }, 20);    
  });
}

exports.translate = function(load) {
  load.source = '"deps ./plugin-dep.js"; (typeof window != "undefined" ? window : global).q = "' + load.source + ':' + load.name + '";';
}