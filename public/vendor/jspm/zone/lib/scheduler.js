var assert = require('assert');
var LinkedList = require('./linked-list.js');
var realNextTick = process.nextTick;

var callbackQueue = new LinkedList();
var zoneQueue = [];
var scheduled = false;

function enqueueCallback(zone, receiver, fn, args) {
  callbackQueue.push([zone, receiver, fn, args]);
  zone._incrementScheduledTaskCount();

  if (!scheduled) {
    scheduled = true;
    realNextTick(processQueues);
  }
}

function enqueueZone(zone) {
  zoneQueue.push(zone);

  if (!scheduled) {
    scheduled = true;
    realNextTick(processQueues);
  }
}

function dequeueZone(zone) {
  var length = zoneQueue.length;
  for (var i = 0; i < length; i++) {
    if (zoneQueue[i] === zone) {
      zoneQueue[i] = null;
    }
  }
}

function processCallbacks() {
  var callbackEntry = callbackQueue.shift();
  for (; callbackEntry !== null; callbackEntry = callbackQueue.shift()) {
    var zone = callbackEntry[0];
    var receiver = callbackEntry[1];
    var fn = callbackEntry[2];
    var args = callbackEntry[3];

    var prevZone = global.zone;
    global.zone = null;
    zone.apply(receiver, fn, args);
    global.zone = prevZone;
    zone._decrementScheduledTaskCount();
    zone = null;
  }
}

function processZones() {
  var zoneEntry = zoneQueue.shift();
  if (zoneEntry && !zoneEntry._closed) {
    zoneEntry._finalize();
  }
}

function processQueues() {
  scheduled = false;
  var zoneEntry;
  var result;

  do {
    processCallbacks();
    processZones();
  } while (zoneQueue.length !== 0);
}

exports.enqueueCallback = enqueueCallback;
exports.enqueueZone = enqueueZone;
exports.dequeueZone = dequeueZone;
