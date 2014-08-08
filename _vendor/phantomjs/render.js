var page = require('webpage').create();
var args = require('system').args;
var params = {};

args.forEach(function(arg) {
  var parts = arg.split('=');
  params[parts[0]] = parts[1];
});

var usage = "url=<url> png=<filename> width=<width> height=<height>";

if (!params.url || !params.png) {
  console.log(usage);
  phantom.exit();
}

page.viewportSize = {
  width: '800',
  height: '400'
};

page.open(params.url, function (status) {
  console.log('Loading a web page');

  setTimeout(function() {
    console.log('rendering panel to ' + params.png);

    page.render(params.png);
    phantom.exit();

  }, 2000);
});
