var Zone = global.zone.Zone;

function getZoneStack() {
  var r = this.stack;
  var z;
  if (Zone.longStackSupport) {
    for (z = this.zone; z && z.parent; z = z.parent) {
      r += '\nIn zone: ' + z.stack;
    }
  } else {
    for (z = this.zone; z && z.parent; z = z.parent) {
      r += '\nIn zone: ' + z.name;
    }

    r += '\n\nNote: Long stack trace is disabled. ' +
         'SET NODE_ENV=development or set Zone.longStackSupport=true to enable it.\n';
  }

  return r;
}

Object.defineProperty(Error.prototype, 'zoneStack', {get: getZoneStack});
