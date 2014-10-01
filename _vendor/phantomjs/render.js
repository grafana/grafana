var page = require('webpage').create();
var args = require('system').args;
var params = {};
var regexp = /^([^=]+)=([^$]+)/;

args.forEach(function(arg) {
  var parts = arg.match(regexp);
  if (!parts) { return; }
  params[parts[1]] = parts[2];
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
  console.log('Loading a web page: ' + params.url);

  setTimeout(function() {
    console.log('rendering panel to ' + params.png);

    page.render(params.png);
    phantom.exit();

  }, 2000);
});
