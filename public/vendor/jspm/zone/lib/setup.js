exports.enable = function() {
  if (!global.zone) {
    var RootZone = require('./zone.js').RootZone;
    global.zone = new RootZone();

    require('./raw-debug.js');
    require('./wrappers/binding.js');
    require('./wrappers/require.js');
    require('./wrappers/dom-globals.js');
    require('./wrappers/process.js');
    require('./error.js');
    require('./debug.js');

    console.error('Zones are enabled. ' +
                  'See \x1b[1;34mhttp://strongloop.com/zone\x1b[0m ' +
                  'for more information.');
  }

  return global.zone;
};
