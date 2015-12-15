/* */ 
function toHex (buf, group, wrap, LE) {
  buf = buf.buffer || buf
  var s = ''
  var l = buf.byteLength || buf.length
  for (var i = 0; i < l ; i++) {
    var byteParam = (i & 0xfffffffc) | (!LE ? i % 4 : 3 - i % 4)
    s += ((buf[byteParam] >> 4).toString(16)) +
         ((buf[byteParam] & 0xf).toString(16)) +
         (group - 1 === i % group ? ' ' : '') +
         (wrap - 1 === i % wrap ? '\n' : '')
  }
  return s
}

var hexpp = module.exports = function hexpp (buffer, opts) {
  opts = opts || {}
  opts.groups = opts.groups || 4
  opts.wrap = opts.wrap || 16
  return toHex(buffer, opts.groups, opts.wrap, opts.bigendian, opts.ints)
}

hexpp.defaults = function (opts) {
  return function (b) {
    return hexpp(b, opts)
  }
}
