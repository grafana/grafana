/* */ 
var test = require('tape');
var evp = require('./index');
var crypto = require('crypto');
function runTest(password) {
  test('password: ' + password, function(t) {
    t.plan(1);
    var keys = evp(password, false, 256, 16);
    var nodeCipher = crypto.createCipher('aes-256-ctr', password);
    var ourCipher = crypto.createCipheriv('aes-256-ctr', keys.key, keys.iv);
    var nodeOut = nodeCipher.update('foooooo');
    var ourOut = ourCipher.update('foooooo');
    t.equals(nodeOut.toString('hex'), ourOut.toString('hex'));
  });
}
runTest('password');
runTest('ふっかつ　あきる　すぶり　はやい　つける　まゆげ　たんさん　みんぞく　ねほりはほり　せまい　たいまつばな　ひはん');
runTest('Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘!͖̬̰̙̗̿̋ͥͥ̂ͣ̐́́͜͞');
runTest('💩');
