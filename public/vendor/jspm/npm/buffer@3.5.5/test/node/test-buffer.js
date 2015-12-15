/* */ 
(function(process) {
  'use strict';
  if (process.env.OBJECT_IMPL)
    global.TYPED_ARRAY_SUPPORT = false;
  var Buffer = require('../../index').Buffer;
  var common = {};
  var assert = require('assert');
  var Buffer = require('../../index').Buffer;
  var SlowBuffer = require('../../index').SlowBuffer;
  var cntr = 0;
  var b = Buffer(1024);
  assert.strictEqual(1024, b.length);
  b[0] = 255;
  assert.strictEqual(b[0], 255);
  for (var i = 0; i < 1024; i++) {
    b[i] = i % 256;
  }
  for (var i = 0; i < 1024; i++) {
    assert.strictEqual(i % 256, b[i]);
  }
  var c = new Buffer(512);
  assert.strictEqual(512, c.length);
  assert.throws(function() {
    Buffer(8).fill('a', -1);
  });
  assert.throws(function() {
    Buffer(8).fill('a', 0, 9);
  });
  Buffer(8).fill('');
  var buf = new Buffer(64);
  buf.fill(10);
  for (var i = 0; i < buf.length; i++)
    assert.equal(buf[i], 10);
  buf.fill(11, 0, buf.length >> 1);
  for (var i = 0; i < buf.length >> 1; i++)
    assert.equal(buf[i], 11);
  for (var i = (buf.length >> 1) + 1; i < buf.length; i++)
    assert.equal(buf[i], 10);
  buf.fill('h');
  for (var i = 0; i < buf.length; i++)
    assert.equal('h'.charCodeAt(0), buf[i]);
  buf.fill(0);
  for (var i = 0; i < buf.length; i++)
    assert.equal(0, buf[i]);
  buf.fill(null);
  for (var i = 0; i < buf.length; i++)
    assert.equal(0, buf[i]);
  buf.fill(1, 16, 32);
  for (var i = 0; i < 16; i++)
    assert.equal(0, buf[i]);
  for (; i < 32; i++)
    assert.equal(1, buf[i]);
  for (; i < buf.length; i++)
    assert.equal(0, buf[i]);
  var buf = new Buffer(10);
  buf.fill('abc');
  assert.equal(buf.toString(), 'abcabcabca');
  buf.fill('է');
  assert.equal(buf.toString(), 'էէէէէ');
  b.fill(++cntr);
  c.fill(++cntr);
  var copied = b.copy(c, 0, 0, 512);
  assert.strictEqual(512, copied);
  for (var i = 0; i < c.length; i++) {
    assert.strictEqual(b[i], c[i]);
  }
  b.fill(++cntr);
  c.fill(++cntr);
  var copied = c.copy(b, 0, 0);
  assert.strictEqual(c.length, copied);
  for (var i = 0; i < c.length; i++) {
    assert.strictEqual(c[i], b[i]);
  }
  b.fill(++cntr);
  c.fill(++cntr);
  var copied = c.copy(b, 0);
  assert.strictEqual(c.length, copied);
  for (var i = 0; i < c.length; i++) {
    assert.strictEqual(c[i], b[i]);
  }
  b.fill(++cntr);
  c.fill(++cntr);
  var copied = b.copy(c);
  assert.strictEqual(c.length, copied);
  for (var i = 0; i < c.length; i++) {
    assert.strictEqual(b[i], c[i]);
  }
  b.fill(++cntr);
  c.fill(++cntr);
  var copied = b.copy(c, 0, b.length - Math.floor(c.length / 2));
  assert.strictEqual(Math.floor(c.length / 2), copied);
  for (var i = 0; i < Math.floor(c.length / 2); i++) {
    assert.strictEqual(b[b.length - Math.floor(c.length / 2) + i], c[i]);
  }
  for (var i = Math.floor(c.length / 2) + 1; i < c.length; i++) {
    assert.strictEqual(c[c.length - 1], c[i]);
  }
  b.fill(++cntr);
  c.fill(++cntr);
  var copied = b.copy(c, 0, 0, 513);
  assert.strictEqual(c.length, copied);
  for (var i = 0; i < c.length; i++) {
    assert.strictEqual(b[i], c[i]);
  }
  b.fill(++cntr);
  b.fill(++cntr, 256);
  var copied = b.copy(b, 0, 256, 1024);
  assert.strictEqual(768, copied);
  for (var i = 0; i < b.length; i++) {
    assert.strictEqual(cntr, b[i]);
  }
  var bb = new Buffer(10);
  bb.fill('hello crazy world');
  var caught_error = null;
  caught_error = null;
  try {
    var copied = b.copy(c, 0, 100, 10);
  } catch (err) {
    caught_error = err;
  }
  assert.throws(function() {
    Buffer(5).copy(Buffer(5), 0, -1);
  }, RangeError);
  b.fill(++cntr);
  c.fill(++cntr);
  var copied = b.copy(c, 0, 0, 1025);
  for (var i = 0; i < c.length; i++) {
    assert.strictEqual(b[i], c[i]);
  }
  assert.throws(function() {
    b.copy(c, 0, 0, -1);
  }, RangeError);
  assert.equal(b.copy(c, 0, 100, 10), 0);
  assert.equal(b.copy(c, 512, 0, 10), 0);
  var caught_error;
  caught_error = null;
  try {
    var copied = b.toString('invalid');
  } catch (err) {
    caught_error = err;
  }
  assert.strictEqual('Unknown encoding: invalid', caught_error.message);
  caught_error = null;
  try {
    var copied = b.write('test string', 0, 5, 'invalid');
  } catch (err) {
    caught_error = err;
  }
  assert.strictEqual('Unknown encoding: invalid', caught_error.message);
  new Buffer('');
  new Buffer('', 'ascii');
  new Buffer('', 'binary');
  new Buffer(0);
  assert.throws(function() {
    b.write('', 2048);
  }, RangeError);
  assert.throws(function() {
    b.write('a', -1);
  }, RangeError);
  assert.throws(function() {
    b.write('a', 2048);
  }, RangeError);
  assert.throws(function() {
    b.write('a', -1);
  }, RangeError);
  b.copy(new Buffer(0), 0, 0, 0);
  b.copy(new Buffer(0), 1, 1, 1);
  b.copy(new Buffer(1), 1, 1, 1);
  b.copy(new Buffer(1), 0, 2048, 2048);
  assert.equal(new Buffer('abc').toString('ascii', 0, 0), '');
  assert.equal(new Buffer('abc').toString('ascii', -100, -100), '');
  assert.equal(new Buffer('abc').toString('ascii', 100, 100), '');
  assert.equal(new Buffer('abc').toString({toString: function() {
      return 'ascii';
    }}), 'abc');
  var writeTest = new Buffer('abcdes');
  writeTest.write('n', 'ascii');
  writeTest.write('o', 'ascii', '1');
  writeTest.write('d', '2', 'ascii');
  writeTest.write('e', 3, 'ascii');
  writeTest.write('j', 'ascii', 4);
  assert.equal(writeTest.toString(), 'nodejs');
  var asciiString = 'hello world';
  var offset = 100;
  for (var i = 0; i < asciiString.length; i++) {
    b[i] = asciiString.charCodeAt(i);
  }
  var asciiSlice = b.toString('ascii', 0, asciiString.length);
  assert.equal(asciiString, asciiSlice);
  var written = b.write(asciiString, offset, 'ascii');
  assert.equal(asciiString.length, written);
  var asciiSlice = b.toString('ascii', offset, offset + asciiString.length);
  assert.equal(asciiString, asciiSlice);
  var sliceA = b.slice(offset, offset + asciiString.length);
  var sliceB = b.slice(offset, offset + asciiString.length);
  for (var i = 0; i < asciiString.length; i++) {
    assert.equal(sliceA[i], sliceB[i]);
  }
  var utf8String = '¡hέlló wôrld!';
  var offset = 100;
  b.write(utf8String, 0, Buffer.byteLength(utf8String), 'utf8');
  var utf8Slice = b.toString('utf8', 0, Buffer.byteLength(utf8String));
  assert.equal(utf8String, utf8Slice);
  var written = b.write(utf8String, offset, 'utf8');
  assert.equal(Buffer.byteLength(utf8String), written);
  utf8Slice = b.toString('utf8', offset, offset + Buffer.byteLength(utf8String));
  assert.equal(utf8String, utf8Slice);
  var sliceA = b.slice(offset, offset + Buffer.byteLength(utf8String));
  var sliceB = b.slice(offset, offset + Buffer.byteLength(utf8String));
  for (var i = 0; i < Buffer.byteLength(utf8String); i++) {
    assert.equal(sliceA[i], sliceB[i]);
  }
  var slice = b.slice(100, 150);
  assert.equal(50, slice.length);
  for (var i = 0; i < 50; i++) {
    assert.equal(b[100 + i], slice[i]);
  }
  var b = new Buffer(5);
  var c = b.slice(0, 4);
  var d = c.slice(0, 2);
  assert.equal(b.parent, c.parent);
  assert.equal(b.parent, d.parent);
  var b = new SlowBuffer(5);
  var c = b.slice(0, 4);
  var d = c.slice(0, 2);
  var testValue = '\u00F6\u65E5\u672C\u8A9E';
  var buffer = new Buffer(32);
  var size = buffer.write(testValue, 0, 'utf8');
  var slice = buffer.toString('utf8', 0, size);
  assert.equal(slice, testValue);
  var a = new Buffer(8);
  for (var i = 0; i < 8; i++)
    a[i] = i;
  var b = a.slice(4, 8);
  assert.equal(4, b[0]);
  assert.equal(5, b[1]);
  assert.equal(6, b[2]);
  assert.equal(7, b[3]);
  var c = b.slice(2, 4);
  assert.equal(6, c[0]);
  assert.equal(7, c[1]);
  var d = new Buffer([23, 42, 255]);
  assert.equal(d.length, 3);
  assert.equal(d[0], 23);
  assert.equal(d[1], 42);
  assert.equal(d[2], 255);
  assert.deepEqual(d, new Buffer(d));
  var e = new Buffer('über');
  assert.deepEqual(e, new Buffer([195, 188, 98, 101, 114]));
  var f = new Buffer('über', 'ascii');
  assert.deepEqual(f, new Buffer([252, 98, 101, 114]));
  ['ucs2', 'ucs-2', 'utf16le', 'utf-16le'].forEach(function(encoding) {
    var f = new Buffer('über', encoding);
    assert.deepEqual(f, new Buffer([252, 0, 98, 0, 101, 0, 114, 0]));
    var f = new Buffer('привет', encoding);
    assert.deepEqual(f, new Buffer([63, 4, 64, 4, 56, 4, 50, 4, 53, 4, 66, 4]));
    assert.equal(f.toString(encoding), 'привет');
    var f = new Buffer([0, 0, 0, 0, 0]);
    assert.equal(f.length, 5);
    var size = f.write('あいうえお', encoding);
    assert.equal(size, 4);
    assert.deepEqual(f, new Buffer([0x42, 0x30, 0x44, 0x30, 0x00]));
  });
  var f = new Buffer('\uD83D\uDC4D', 'utf-16le');
  assert.equal(f.length, 4);
  assert.deepEqual(f, new Buffer('3DD84DDC', 'hex'));
  var arrayIsh = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    length: 4
  };
  var g = new Buffer(arrayIsh);
  assert.deepEqual(g, new Buffer([0, 1, 2, 3]));
  var strArrayIsh = {
    0: '0',
    1: '1',
    2: '2',
    3: '3',
    length: 4
  };
  g = new Buffer(strArrayIsh);
  assert.deepEqual(g, new Buffer([0, 1, 2, 3]));
  assert.equal('TWFu', (new Buffer('Man')).toString('base64'));
  var expected = [0xff, 0xff, 0xbe, 0xff, 0xef, 0xbf, 0xfb, 0xef, 0xff];
  assert.deepEqual(Buffer('//++/++/++//', 'base64'), Buffer(expected));
  assert.deepEqual(Buffer('__--_--_--__', 'base64'), Buffer(expected));
  var quote = 'Man is distinguished, not only by his reason, but by this ' + 'singular passion from other animals, which is a lust ' + 'of the mind, that by a perseverance of delight in the continued ' + 'and indefatigable generation of knowledge, exceeds the short ' + 'vehemence of any carnal pleasure.';
  var expected = 'TWFuIGlzIGRpc3Rpbmd1aXNoZWQsIG5vdCBvbmx5IGJ5IGhpcyByZWFzb24s' + 'IGJ1dCBieSB0aGlzIHNpbmd1bGFyIHBhc3Npb24gZnJvbSBvdGhlciBhbmltY' + 'WxzLCB3aGljaCBpcyBhIGx1c3Qgb2YgdGhlIG1pbmQsIHRoYXQgYnkgYSBwZX' + 'JzZXZlcmFuY2Ugb2YgZGVsaWdodCBpbiB0aGUgY29udGludWVkIGFuZCBpbmR' + 'lZmF0aWdhYmxlIGdlbmVyYXRpb24gb2Yga25vd2xlZGdlLCBleGNlZWRzIHRo' + 'ZSBzaG9ydCB2ZWhlbWVuY2Ugb2YgYW55IGNhcm5hbCBwbGVhc3VyZS4=';
  assert.equal(expected, (new Buffer(quote)).toString('base64'));
  b = new Buffer(1024);
  var bytesWritten = b.write(expected, 0, 'base64');
  assert.equal(quote.length, bytesWritten);
  assert.equal(quote, b.toString('ascii', 0, quote.length));
  var expectedWhite = expected.slice(0, 60) + ' \n' + expected.slice(60, 120) + ' \n' + expected.slice(120, 180) + ' \n' + expected.slice(180, 240) + ' \n' + expected.slice(240, 300) + '\n' + expected.slice(300, 360) + '\n';
  b = new Buffer(1024);
  bytesWritten = b.write(expectedWhite, 0, 'base64');
  assert.equal(quote.length, bytesWritten);
  assert.equal(quote, b.toString('ascii', 0, quote.length));
  b = new Buffer(expectedWhite, 'base64');
  assert.equal(quote.length, b.length);
  assert.equal(quote, b.toString('ascii', 0, quote.length));
  var expectedIllegal = expected.slice(0, 60) + ' \x80' + expected.slice(60, 120) + ' \xff' + expected.slice(120, 180) + ' \x00' + expected.slice(180, 240) + ' \x98' + expected.slice(240, 300) + '\x03' + expected.slice(300, 360);
  b = new Buffer(expectedIllegal, 'base64');
  assert.equal(quote.length, b.length);
  assert.equal(quote, b.toString('ascii', 0, quote.length));
  assert.equal(new Buffer('', 'base64').toString(), '');
  assert.equal(new Buffer('K', 'base64').toString(), '');
  assert.equal(new Buffer('Kg==', 'base64').toString(), '*');
  assert.equal(new Buffer('Kio=', 'base64').toString(), '**');
  assert.equal(new Buffer('Kioq', 'base64').toString(), '***');
  assert.equal(new Buffer('KioqKg==', 'base64').toString(), '****');
  assert.equal(new Buffer('KioqKio=', 'base64').toString(), '*****');
  assert.equal(new Buffer('KioqKioq', 'base64').toString(), '******');
  assert.equal(new Buffer('KioqKioqKg==', 'base64').toString(), '*******');
  assert.equal(new Buffer('KioqKioqKio=', 'base64').toString(), '********');
  assert.equal(new Buffer('KioqKioqKioq', 'base64').toString(), '*********');
  assert.equal(new Buffer('KioqKioqKioqKg==', 'base64').toString(), '**********');
  assert.equal(new Buffer('KioqKioqKioqKio=', 'base64').toString(), '***********');
  assert.equal(new Buffer('KioqKioqKioqKioq', 'base64').toString(), '************');
  assert.equal(new Buffer('KioqKioqKioqKioqKg==', 'base64').toString(), '*************');
  assert.equal(new Buffer('KioqKioqKioqKioqKio=', 'base64').toString(), '**************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioq', 'base64').toString(), '***************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKg==', 'base64').toString(), '****************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKio=', 'base64').toString(), '*****************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKioq', 'base64').toString(), '******************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKioqKg==', 'base64').toString(), '*******************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKioqKio=', 'base64').toString(), '********************');
  assert.equal(new Buffer('Kg', 'base64').toString(), '*');
  assert.equal(new Buffer('Kio', 'base64').toString(), '**');
  assert.equal(new Buffer('KioqKg', 'base64').toString(), '****');
  assert.equal(new Buffer('KioqKio', 'base64').toString(), '*****');
  assert.equal(new Buffer('KioqKioqKg', 'base64').toString(), '*******');
  assert.equal(new Buffer('KioqKioqKio', 'base64').toString(), '********');
  assert.equal(new Buffer('KioqKioqKioqKg', 'base64').toString(), '**********');
  assert.equal(new Buffer('KioqKioqKioqKio', 'base64').toString(), '***********');
  assert.equal(new Buffer('KioqKioqKioqKioqKg', 'base64').toString(), '*************');
  assert.equal(new Buffer('KioqKioqKioqKioqKio', 'base64').toString(), '**************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKg', 'base64').toString(), '****************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKio', 'base64').toString(), '*****************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKioqKg', 'base64').toString(), '*******************');
  assert.equal(new Buffer('KioqKioqKioqKioqKioqKioqKio', 'base64').toString(), '********************');
  assert.equal(new Buffer('72INjkR5fchcxk9+VgdGPFJDxUBFR5/rMFsghgxADiw==', 'base64').length, 32);
  assert.equal(new Buffer('72INjkR5fchcxk9+VgdGPFJDxUBFR5/rMFsghgxADiw=', 'base64').length, 32);
  assert.equal(new Buffer('72INjkR5fchcxk9+VgdGPFJDxUBFR5/rMFsghgxADiw', 'base64').length, 32);
  assert.equal(new Buffer('w69jACy6BgZmaFvv96HG6MYksWytuZu3T1FvGnulPg==', 'base64').length, 31);
  assert.equal(new Buffer('w69jACy6BgZmaFvv96HG6MYksWytuZu3T1FvGnulPg=', 'base64').length, 31);
  assert.equal(new Buffer('w69jACy6BgZmaFvv96HG6MYksWytuZu3T1FvGnulPg', 'base64').length, 31);
  var dot = new Buffer('//4uAA==', 'base64');
  assert.equal(dot[0], 0xff);
  assert.equal(dot[1], 0xfe);
  assert.equal(dot[2], 0x2e);
  assert.equal(dot[3], 0x00);
  assert.equal(dot.toString('base64'), '//4uAA==');
  var segments = ['TWFkbmVzcz8h', 'IFRoaXM=', 'IGlz', 'IG5vZGUuanMh'];
  var buf = new Buffer(64);
  var pos = 0;
  for (var i = 0; i < segments.length; ++i) {
    pos += b.write(segments[i], pos, 'base64');
  }
  assert.equal(b.toString('binary', 0, pos), 'Madness?! This is node.js!');
  var l = Buffer.poolSize + 5;
  var s = '';
  for (i = 0; i < l; i++) {
    s += 'h';
  }
  var b = new Buffer(s);
  for (i = 0; i < l; i++) {
    assert.equal('h'.charCodeAt(0), b[i]);
  }
  var sb = b.toString();
  assert.equal(sb.length, s.length);
  assert.equal(sb, s);
  b = new Buffer('abcde');
  assert.equal('bcde', b.slice(1).toString());
  assert.equal(0, Buffer('hello').slice(0, 0).length);
  var hexb = new Buffer(256);
  for (var i = 0; i < 256; i++) {
    hexb[i] = i;
  }
  var hexStr = hexb.toString('hex');
  assert.equal(hexStr, '000102030405060708090a0b0c0d0e0f' + '101112131415161718191a1b1c1d1e1f' + '202122232425262728292a2b2c2d2e2f' + '303132333435363738393a3b3c3d3e3f' + '404142434445464748494a4b4c4d4e4f' + '505152535455565758595a5b5c5d5e5f' + '606162636465666768696a6b6c6d6e6f' + '707172737475767778797a7b7c7d7e7f' + '808182838485868788898a8b8c8d8e8f' + '909192939495969798999a9b9c9d9e9f' + 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf' + 'b0b1b2b3b4b5b6b7b8b9babbbcbdbebf' + 'c0c1c2c3c4c5c6c7c8c9cacbcccdcecf' + 'd0d1d2d3d4d5d6d7d8d9dadbdcdddedf' + 'e0e1e2e3e4e5e6e7e8e9eaebecedeeef' + 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
  var hexb2 = new Buffer(hexStr, 'hex');
  for (var i = 0; i < 256; i++) {
    assert.equal(hexb2[i], hexb[i]);
  }
  var b = new Buffer([1, 2, 3, 4, 5]);
  var b2 = b.toString('hex', 1, 10000);
  var b3 = b.toString('hex', 1, 5);
  var b4 = b.toString('hex', 1);
  assert.equal(b2, b3);
  assert.equal(b2, b4);
  function buildBuffer(data) {
    if (Array.isArray(data)) {
      var buffer = new Buffer(data.length);
      data.forEach(function(v, k) {
        buffer[k] = v;
      });
      return buffer;
    }
    return null;
  }
  var x = buildBuffer([0x81, 0xa3, 0x66, 0x6f, 0x6f, 0xa3, 0x62, 0x61, 0x72]);
  assert.equal('<Buffer 81 a3 66 6f 6f a3 62 61 72>', x.inspect());
  var z = x.slice(4);
  assert.equal(5, z.length);
  assert.equal(0x6f, z[0]);
  assert.equal(0xa3, z[1]);
  assert.equal(0x62, z[2]);
  assert.equal(0x61, z[3]);
  assert.equal(0x72, z[4]);
  var z = x.slice(0);
  assert.equal(z.length, x.length);
  var z = x.slice(0, 4);
  assert.equal(4, z.length);
  assert.equal(0x81, z[0]);
  assert.equal(0xa3, z[1]);
  var z = x.slice(0, 9);
  assert.equal(9, z.length);
  var z = x.slice(1, 4);
  assert.equal(3, z.length);
  assert.equal(0xa3, z[0]);
  var z = x.slice(2, 4);
  assert.equal(2, z.length);
  assert.equal(0x66, z[0]);
  assert.equal(0x6f, z[1]);
  assert.equal(0, Buffer('hello').slice(0, 0).length);
  ['ucs2', 'ucs-2', 'utf16le', 'utf-16le'].forEach(function(encoding) {
    var b = new Buffer(10);
    b.write('あいうえお', encoding);
    assert.equal(b.toString(encoding), 'あいうえお');
  });
  var b = Buffer([0xde, 0xad, 0xbe, 0xef]);
  var s = String.fromCharCode(0xffff);
  b.write(s, 0, 'binary');
  assert.equal(0xff, b[0]);
  assert.equal(0xad, b[1]);
  assert.equal(0xbe, b[2]);
  assert.equal(0xef, b[3]);
  s = String.fromCharCode(0xaaee);
  b.write(s, 0, 'binary');
  assert.equal(0xee, b[0]);
  assert.equal(0xad, b[1]);
  assert.equal(0xbe, b[2]);
  assert.equal(0xef, b[3]);
  var buf = new Buffer('\0');
  assert.equal(buf.length, 1);
  buf = new Buffer('\0\0');
  assert.equal(buf.length, 2);
  buf = new Buffer(2);
  var written = buf.write('');
  assert.equal(written, 0);
  written = buf.write('\0');
  assert.equal(written, 1);
  written = buf.write('a\0');
  assert.equal(written, 2);
  written = buf.write('あ');
  assert.equal(written, 0);
  written = buf.write('\0あ');
  assert.equal(written, 1);
  written = buf.write('\0\0あ');
  assert.equal(written, 2);
  buf = new Buffer(10);
  written = buf.write('あいう');
  assert.equal(written, 9);
  written = buf.write('あいう\0');
  assert.equal(written, 10);
  var buf = new Buffer(4);
  buf.fill(0xFF);
  var written = buf.write('abcd', 1, 2, 'utf8');
  assert.equal(written, 2);
  assert.equal(buf[0], 0xFF);
  assert.equal(buf[1], 0x61);
  assert.equal(buf[2], 0x62);
  assert.equal(buf[3], 0xFF);
  buf.fill(0xFF);
  written = buf.write('abcd', 1, 4);
  assert.equal(written, 3);
  assert.equal(buf[0], 0xFF);
  assert.equal(buf[1], 0x61);
  assert.equal(buf[2], 0x62);
  assert.equal(buf[3], 0x63);
  buf.fill(0xFF);
  written = buf.write('abcd', 'utf8', 1, 2);
  assert.equal(written, 2);
  assert.equal(buf[0], 0xFF);
  assert.equal(buf[1], 0x61);
  assert.equal(buf[2], 0x62);
  assert.equal(buf[3], 0xFF);
  buf.fill(0xFF);
  written = buf.write('abcdef', 1, 2, 'hex');
  assert.equal(written, 2);
  assert.equal(buf[0], 0xFF);
  assert.equal(buf[1], 0xAB);
  assert.equal(buf[2], 0xCD);
  assert.equal(buf[3], 0xFF);
  ['ucs2', 'ucs-2', 'utf16le', 'utf-16le'].forEach(function(encoding) {
    buf.fill(0xFF);
    written = buf.write('abcd', 0, 2, encoding);
    assert.equal(written, 2);
    assert.equal(buf[0], 0x61);
    assert.equal(buf[1], 0x00);
    assert.equal(buf[2], 0xFF);
    assert.equal(buf[3], 0xFF);
  });
  var b = new Buffer(16);
  assert.equal(4, b.writeUInt32LE(0, 0));
  assert.equal(6, b.writeUInt16LE(0, 4));
  assert.equal(7, b.writeUInt8(0, 6));
  assert.equal(8, b.writeInt8(0, 7));
  assert.equal(16, b.writeDoubleLE(0, 8));
  buf = new Buffer('ab\ud800cd', 'utf8');
  assert.equal(buf[0], 0x61);
  assert.equal(buf[1], 0x62);
  assert.equal(buf[2], 0xef);
  assert.equal(buf[3], 0xbf);
  assert.equal(buf[4], 0xbd);
  assert.equal(buf[5], 0x63);
  assert.equal(buf[6], 0x64);
  buf = new Buffer([0, 0, 0, 0, 0]);
  var sub = buf.slice(0, 4);
  written = sub.write('12345', 'binary');
  assert.equal(written, 4);
  assert.equal(buf[4], 0);
  Buffer(3.3).fill().toString();
  assert.equal(Buffer(-1).length, 0);
  assert.equal(Buffer(NaN).length, 0);
  assert.equal(Buffer(3.3).length, 3);
  assert.equal(Buffer({length: 3.3}).length, 3);
  assert.equal(Buffer({length: 'BAM'}).length, 0);
  assert.equal(Buffer('99').length, 2);
  assert.equal(Buffer('13.37').length, 5);
  'ascii utf8 hex base64 binary'.split(' ').forEach(function(enc) {
    assert.equal(Buffer(1).write('aaaaaa', 0, 1, enc), 1);
  });
  var a = Buffer(3);
  var b = Buffer('xxx');
  a.write('aaaaaaaa', 'base64');
  assert.equal(b.toString(), 'xxx');
  Buffer(Buffer(0), 0, 0);
  ['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le'].forEach(function(enc) {
    assert.equal(Buffer.isEncoding(enc), true);
  });
  ['utf9', 'utf-7', 'Unicode-FTW', 'new gnu gun'].forEach(function(enc) {
    assert.equal(Buffer.isEncoding(enc), false);
  });
  (function() {
    var buffer = new Buffer('test'),
        string = JSON.stringify(buffer);
    assert.equal(string, '{"type":"Buffer","data":[116,101,115,116]}');
    assert.deepEqual(buffer, JSON.parse(string, function(key, value) {
      return value && value.type === 'Buffer' ? new Buffer(value.data) : value;
    }));
  })();
  (function() {
    var buf = new Buffer('test');
    var json = JSON.stringify(buf);
    var obj = JSON.parse(json);
    var copy = new Buffer(obj);
    assert(buf.equals(copy));
  })();
  assert.throws(function() {
    new Buffer(0xFFFFFFFF);
  }, RangeError);
  assert.throws(function() {
    new Buffer(0xFFFFFFFFF);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.readFloatLE(0xffffffff);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.writeFloatLE(0.0, 0xffffffff);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.readFloatLE(0xffffffff);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.writeFloatLE(0.0, 0xffffffff);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.readFloatLE(-1);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.writeFloatLE(0.0, -1);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.readFloatLE(-1);
  }, RangeError);
  assert.throws(function() {
    var buf = new Buffer(8);
    buf.writeFloatLE(0.0, -1);
  }, RangeError);
  var buf = new Buffer(0);
  assert.throws(function() {
    buf.readUInt8(0);
  }, RangeError);
  assert.throws(function() {
    buf.readInt8(0);
  }, RangeError);
  var buf = new Buffer([0xFF]);
  assert.equal(buf.readUInt8(0), 255);
  assert.equal(buf.readInt8(0), -1);
  [16, 32].forEach(function(bits) {
    var buf = new Buffer(bits / 8 - 1);
    assert.throws(function() {
      buf['readUInt' + bits + 'BE'](0);
    }, RangeError, 'readUInt' + bits + 'BE');
    assert.throws(function() {
      buf['readUInt' + bits + 'LE'](0);
    }, RangeError, 'readUInt' + bits + 'LE');
    assert.throws(function() {
      buf['readInt' + bits + 'BE'](0);
    }, RangeError, 'readInt' + bits + 'BE()');
    assert.throws(function() {
      buf['readInt' + bits + 'LE'](0);
    }, RangeError, 'readInt' + bits + 'LE()');
  });
  [16, 32].forEach(function(bits) {
    var buf = new Buffer([0xFF, 0xFF, 0xFF, 0xFF]);
    assert.equal(buf['readUInt' + bits + 'BE'](0), (0xFFFFFFFF >>> (32 - bits)));
    assert.equal(buf['readUInt' + bits + 'LE'](0), (0xFFFFFFFF >>> (32 - bits)));
    assert.equal(buf['readInt' + bits + 'BE'](0), (0xFFFFFFFF >> (32 - bits)));
    assert.equal(buf['readInt' + bits + 'LE'](0), (0xFFFFFFFF >> (32 - bits)));
  });
  (function() {
    var buf = new Buffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    assert.equal(buf.readUIntLE(0, 1), 0x01);
    assert.equal(buf.readUIntBE(0, 1), 0x01);
    assert.equal(buf.readUIntLE(0, 3), 0x030201);
    assert.equal(buf.readUIntBE(0, 3), 0x010203);
    assert.equal(buf.readUIntLE(0, 5), 0x0504030201);
    assert.equal(buf.readUIntBE(0, 5), 0x0102030405);
    assert.equal(buf.readUIntLE(0, 6), 0x060504030201);
    assert.equal(buf.readUIntBE(0, 6), 0x010203040506);
    assert.equal(buf.readIntLE(0, 1), 0x01);
    assert.equal(buf.readIntBE(0, 1), 0x01);
    assert.equal(buf.readIntLE(0, 3), 0x030201);
    assert.equal(buf.readIntBE(0, 3), 0x010203);
    assert.equal(buf.readIntLE(0, 5), 0x0504030201);
    assert.equal(buf.readIntBE(0, 5), 0x0102030405);
    assert.equal(buf.readIntLE(0, 6), 0x060504030201);
    assert.equal(buf.readIntBE(0, 6), 0x010203040506);
  })();
  (function() {
    var buf = new Buffer(3);
    buf.writeUIntLE(0x123456, 0, 3);
    assert.deepEqual(buf.toJSON().data, [0x56, 0x34, 0x12]);
    assert.equal(buf.readUIntLE(0, 3), 0x123456);
    buf = new Buffer(3);
    buf.writeUIntBE(0x123456, 0, 3);
    assert.deepEqual(buf.toJSON().data, [0x12, 0x34, 0x56]);
    assert.equal(buf.readUIntBE(0, 3), 0x123456);
    buf = new Buffer(3);
    buf.writeIntLE(0x123456, 0, 3);
    assert.deepEqual(buf.toJSON().data, [0x56, 0x34, 0x12]);
    assert.equal(buf.readIntLE(0, 3), 0x123456);
    buf = new Buffer(3);
    buf.writeIntBE(0x123456, 0, 3);
    assert.deepEqual(buf.toJSON().data, [0x12, 0x34, 0x56]);
    assert.equal(buf.readIntBE(0, 3), 0x123456);
    buf = new Buffer(3);
    buf.writeIntLE(-0x123456, 0, 3);
    assert.deepEqual(buf.toJSON().data, [0xaa, 0xcb, 0xed]);
    assert.equal(buf.readIntLE(0, 3), -0x123456);
    buf = new Buffer(3);
    buf.writeIntBE(-0x123456, 0, 3);
    assert.deepEqual(buf.toJSON().data, [0xed, 0xcb, 0xaa]);
    assert.equal(buf.readIntBE(0, 3), -0x123456);
    buf = new Buffer(5);
    buf.writeUIntLE(0x1234567890, 0, 5);
    assert.deepEqual(buf.toJSON().data, [0x90, 0x78, 0x56, 0x34, 0x12]);
    assert.equal(buf.readUIntLE(0, 5), 0x1234567890);
    buf = new Buffer(5);
    buf.writeUIntBE(0x1234567890, 0, 5);
    assert.deepEqual(buf.toJSON().data, [0x12, 0x34, 0x56, 0x78, 0x90]);
    assert.equal(buf.readUIntBE(0, 5), 0x1234567890);
    buf = new Buffer(5);
    buf.writeIntLE(0x1234567890, 0, 5);
    assert.deepEqual(buf.toJSON().data, [0x90, 0x78, 0x56, 0x34, 0x12]);
    assert.equal(buf.readIntLE(0, 5), 0x1234567890);
    buf = new Buffer(5);
    buf.writeIntBE(0x1234567890, 0, 5);
    assert.deepEqual(buf.toJSON().data, [0x12, 0x34, 0x56, 0x78, 0x90]);
    assert.equal(buf.readIntBE(0, 5), 0x1234567890);
    buf = new Buffer(5);
    buf.writeIntLE(-0x1234567890, 0, 5);
    assert.deepEqual(buf.toJSON().data, [0x70, 0x87, 0xa9, 0xcb, 0xed]);
    assert.equal(buf.readIntLE(0, 5), -0x1234567890);
    buf = new Buffer(5);
    buf.writeIntBE(-0x1234567890, 0, 5);
    assert.deepEqual(buf.toJSON().data, [0xed, 0xcb, 0xa9, 0x87, 0x70]);
    assert.equal(buf.readIntBE(0, 5), -0x1234567890);
  })();
  (function() {
    var buf = new Buffer('0123456789');
    assert.equal(buf.slice(-10, 10), '0123456789');
    assert.equal(buf.slice(-20, 10), '0123456789');
    assert.equal(buf.slice(-20, -10), '');
    assert.equal(buf.slice(0, -1), '012345678');
    assert.equal(buf.slice(2, -2), '234567');
    assert.equal(buf.slice(0, 65536), '0123456789');
    assert.equal(buf.slice(65536, 0), '');
    for (var i = 0,
        s = buf.toString(); i < buf.length; ++i) {
      assert.equal(buf.slice(-i), s.slice(-i));
      assert.equal(buf.slice(0, -i), s.slice(0, -i));
    }
    SlowBuffer(0).slice(0, 1);
  })();
  assert.throws(function() {
    Buffer('', 'buffer');
  }, TypeError);
  (function() {
    var a = [0];
    for (var i = 0; i < 7; ++i)
      a = a.concat(a);
    a = a.map(function(_, i) {
      return i;
    });
    var b = Buffer(a);
    var c = Buffer(b);
    assert.equal(b.length, a.length);
    assert.equal(c.length, a.length);
    for (var i = 0,
        k = a.length; i < k; ++i) {
      assert.equal(a[i], i);
      assert.equal(b[i], i);
      assert.equal(c[i], i);
    }
  })();
  assert.throws(function() {
    new Buffer((-1 >>> 0) + 1);
  }, RangeError);
  assert.throws(function() {
    new SlowBuffer((-1 >>> 0) + 1);
  }, RangeError);
  if (common.hasCrypto) {
    var b1 = new Buffer('YW55=======', 'base64');
    var b2 = new Buffer('YW55', 'base64');
    assert.equal(1, 1);
  } else {}
  var b = new Buffer(1).fill('a');
  var c = new Buffer(1).fill('c');
  var d = new Buffer(2).fill('aa');
  assert.equal(b.compare(c), -1);
  assert.equal(c.compare(d), 1);
  assert.equal(d.compare(b), 1);
  assert.equal(b.compare(d), -1);
  assert.equal(b.compare(b), 0);
  assert.equal(Buffer.compare(b, c), -1);
  assert.equal(Buffer.compare(c, d), 1);
  assert.equal(Buffer.compare(d, b), 1);
  assert.equal(Buffer.compare(b, d), -1);
  assert.equal(Buffer.compare(c, c), 0);
  assert.throws(function() {
    var b = new Buffer(1);
    Buffer.compare(b, 'abc');
  });
  assert.throws(function() {
    var b = new Buffer(1);
    Buffer.compare('abc', b);
  });
  assert.throws(function() {
    var b = new Buffer(1);
    b.compare('abc');
  });
  var b = new Buffer(5).fill('abcdf');
  var c = new Buffer(5).fill('abcdf');
  var d = new Buffer(5).fill('abcde');
  var e = new Buffer(6).fill('abcdef');
  assert.ok(b.equals(c));
  assert.ok(!c.equals(d));
  assert.ok(!d.equals(e));
  assert.ok(d.equals(d));
  assert.throws(function() {
    var b = new Buffer(1);
    b.equals('abc');
  });
  assert.throws(function() {
    Buffer(1422561062959).toString('utf8');
  });
  var ps = Buffer.poolSize;
  Buffer.poolSize = 0;
  assert.equal(Buffer(1).parent, undefined);
  Buffer.poolSize = ps;
  assert.throws(function() {
    Buffer(10).copy();
  });
  assert.throws(function() {
    new Buffer();
  }, /must start with number, buffer, array or string/);
  assert.throws(function() {
    new Buffer(null);
  }, /must start with number, buffer, array or string/);
})(require('process'));
