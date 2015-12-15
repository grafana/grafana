/* */ 
'use strict';
var api_1 = require('../../core/render/api');
var event_serializer_1 = require('./event_serializer');
var exceptions_1 = require('../../facade/exceptions');
var collection_1 = require('../../facade/collection');
var async_1 = require('../../facade/async');
var EventDispatcher = (function() {
  function EventDispatcher(_viewRef, _sink, _serializer) {
    this._viewRef = _viewRef;
    this._sink = _sink;
    this._serializer = _serializer;
  }
  EventDispatcher.prototype.dispatchRenderEvent = function(elementIndex, eventName, locals) {
    var e = locals.get('$event');
    var serializedEvent;
    switch (e.type) {
      case "click":
      case "mouseup":
      case "mousedown":
      case "dblclick":
      case "contextmenu":
      case "mouseenter":
      case "mouseleave":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "show":
        serializedEvent = event_serializer_1.serializeMouseEvent(e);
        break;
      case "keydown":
      case "keypress":
      case "keyup":
        serializedEvent = event_serializer_1.serializeKeyboardEvent(e);
        break;
      case "input":
      case "change":
      case "blur":
        serializedEvent = event_serializer_1.serializeEventWithTarget(e);
        break;
      case "abort":
      case "afterprint":
      case "beforeprint":
      case "cached":
      case "canplay":
      case "canplaythrough":
      case "chargingchange":
      case "chargingtimechange":
      case "close":
      case "dischargingtimechange":
      case "DOMContentLoaded":
      case "downloading":
      case "durationchange":
      case "emptied":
      case "ended":
      case "error":
      case "fullscreenchange":
      case "fullscreenerror":
      case "invalid":
      case "languagechange":
      case "levelfchange":
      case "loadeddata":
      case "loadedmetadata":
      case "obsolete":
      case "offline":
      case "online":
      case "open":
      case "orientatoinchange":
      case "pause":
      case "pointerlockchange":
      case "pointerlockerror":
      case "play":
      case "playing":
      case "ratechange":
      case "readystatechange":
      case "reset":
      case "scroll":
      case "seeked":
      case "seeking":
      case "stalled":
      case "submit":
      case "success":
      case "suspend":
      case "timeupdate":
      case "updateready":
      case "visibilitychange":
      case "volumechange":
      case "waiting":
        serializedEvent = event_serializer_1.serializeGenericEvent(e);
        break;
      default:
        throw new exceptions_1.BaseException(eventName + " not supported on WebWorkers");
    }
    var serializedLocals = collection_1.StringMapWrapper.create();
    collection_1.StringMapWrapper.set(serializedLocals, '$event', serializedEvent);
    async_1.ObservableWrapper.callEmit(this._sink, {
      "viewRef": this._serializer.serialize(this._viewRef, api_1.RenderViewRef),
      "elementIndex": elementIndex,
      "eventName": eventName,
      "locals": serializedLocals
    });
    return false;
  };
  return EventDispatcher;
})();
exports.EventDispatcher = EventDispatcher;
