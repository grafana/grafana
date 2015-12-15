/* */ 
(function(process) {
  var concat = require('concat-stream');
  var fs = require('fs');
  var hyperquest = require('hyperquest');
  var cp = require('child_process');
  var split = require('split');
  var through = require('through2');
  var url = 'https://api.github.com/repos/nodejs/io.js/contents';
  var dirs = ['/test/parallel', '/test/pummel'];
  cp.execSync('rm -rf node/*.js', {cwd: __dirname + '/../test'});
  cp.execSync('rm -rf node-es6/*.js', {cwd: __dirname + '/../test'});
  var httpOpts = {headers: {'User-Agent': null}};
  dirs.forEach(function(dir) {
    var req = hyperquest(url + dir, httpOpts);
    req.pipe(concat(function(data) {
      if (req.response.statusCode !== 200) {
        throw new Error(url + dir + ': ' + data.toString());
      }
      downloadBufferTests(dir, JSON.parse(data));
    }));
  });
  function downloadBufferTests(dir, files) {
    files.forEach(function(file) {
      if (!/test-buffer.*/.test(file.name))
        return;
      var path;
      if (file.name === 'test-buffer-iterator.js' || file.name === 'test-buffer-arraybuffer.js') {
        path = __dirname + '/../test/node-es6/' + file.name;
      } else if (file.name === 'test-buffer-fakes.js') {
        return;
      } else {
        path = __dirname + '/../test/node/' + file.name;
      }
      console.log(file.download_url);
      hyperquest(file.download_url, httpOpts).pipe(split()).pipe(testfixer(file.name)).pipe(fs.createWriteStream(path)).on('finish', function() {
        console.log('wrote ' + file.name);
      });
    });
  }
  function testfixer(filename) {
    var firstline = true;
    return through(function(line, enc, cb) {
      line = line.toString();
      if (firstline) {
        var preamble = 'if (process.env.OBJECT_IMPL) global.TYPED_ARRAY_SUPPORT = false;\n' + 'var Buffer = require(\'../../\').Buffer;';
        if (/use strict/.test(line))
          line += '\n' + preamble;
        else
          line + preamble + '\n' + line;
        firstline = false;
      }
      line = line.replace(/(const|let) /g, 'var ');
      line = line.replace(/(var common = require.*)/g, 'var common = {};');
      line = line.replace(/buf instanceof Buffer/g, 'Buffer.isBuffer(buf)');
      line = line.replace(/(.*)require\('buffer'\)(.*)/g, '$1require(\'../../\')$2');
      line = line.replace(/require\('smalloc'\)/g, '{ kMaxLength: process.env.OBJECT_IMPL ? 0x3fffffff : 0x7fffffff }');
      line = line.replace(/(.*console\..*)/g, '// $1');
      if (filename === 'test-buffer-big.js') {
        line = line.replace(/(.*new Int8Array.*RangeError.*)/, '// $1');
        line = line.replace(/(.*new ArrayBuffer.*RangeError.*)/, '// $1');
        line = line.replace(/(.*new Float64Array.*RangeError.*)/, '// $1');
      }
      if (filename === 'test-buffer.js') {
        line = line.replace(/b\[0\] = -1;/, 'b[0] = 255;');
      }
      if (filename === 'test-buffer.js') {
        line = line.replace(/^(\s*)(var crypto = require.*)/, '$1// $2');
        line = line.replace(/(crypto.createHash.*\))/, '1 /*$1*/');
      }
      cb(null, line + '\n');
    });
  }
})(require('process'));
