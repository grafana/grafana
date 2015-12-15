/* */ 
var baseToString = require('../internal/baseToString'),
    deburrLetter = require('../internal/deburrLetter');
var reComboMark = /[\u0300-\u036f\ufe20-\ufe23]/g;
var reLatin1 = /[\xc0-\xd6\xd8-\xde\xdf-\xf6\xf8-\xff]/g;
function deburr(string) {
  string = baseToString(string);
  return string && string.replace(reLatin1, deburrLetter).replace(reComboMark, '');
}
module.exports = deburr;
