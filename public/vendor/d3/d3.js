// Import main D3.js module and combine it with another
var d3 = Object.assign({}, require('./d3.v4.min.js'), require('./d3-scale-chromatic.min.js'));
module.exports = d3;
