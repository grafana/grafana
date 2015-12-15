/* */ 
(function(process) {
  var cp = require('child_process');
  var runBrowserTests = !process.env.TRAVIS_PULL_REQUEST || process.env.TRAVIS_PULL_REQUEST === 'false';
  var node = cp.spawn('npm', ['run', 'test-node'], {stdio: 'inherit'});
  node.on('close', function(code) {
    if (code === 0 && runBrowserTests) {
      var browser = cp.spawn('npm', ['run', 'test-browser'], {stdio: 'inherit'});
      browser.on('close', function(code) {
        process.exit(code);
      });
    } else {
      process.exit(code);
    }
  });
})(require('process'));
