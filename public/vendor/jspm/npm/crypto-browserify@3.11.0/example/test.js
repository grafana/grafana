/* */ 
var crypto = require('@empty');
var abc = crypto.createHash('sha1').update('abc').digest('hex');
console.log(abc);
