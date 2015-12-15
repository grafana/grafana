/* */ 
'use strict';
if (require('./$.descriptors')) {
  var $export = require('./$.export'),
      $typed = require('./$.typed'),
      buffer = require('./$.buffer'),
      toIndex = require('./$.to-index'),
      toLength = require('./$.to-length'),
      isObject = require('./$.is-object'),
      TYPED_ARRAY = require('./$.wks')('typed_array'),
      $ArrayBuffer = buffer.ArrayBuffer,
      $DataView = buffer.DataView,
      $slice = $ArrayBuffer && $ArrayBuffer.prototype.slice,
      VIEW = $typed.VIEW,
      ARRAY_BUFFER = 'ArrayBuffer';
  $export($export.G + $export.W + $export.F * !$typed.ABV, {ArrayBuffer: $ArrayBuffer});
  $export($export.S + $export.F * !$typed.CONSTR, ARRAY_BUFFER, {isView: function isView(it) {
      return isObject(it) && VIEW in it;
    }});
  $export($export.P + $export.F * require('./$.fails')(function() {
    return !new $ArrayBuffer(2).slice(1, undefined).byteLength;
  }), ARRAY_BUFFER, {slice: function slice(start, end) {
      if ($slice !== undefined && end === undefined)
        return $slice.call(this, start);
      var len = this.byteLength,
          first = toIndex(start, len),
          final = toIndex(end === undefined ? len : end, len),
          result = new $ArrayBuffer(toLength(final - first)),
          viewS = new $DataView(this),
          viewT = new $DataView(result),
          index = 0;
      while (first < final) {
        viewT.setUint8(index++, viewS.getUint8(first++));
      }
      return result;
    }});
}
