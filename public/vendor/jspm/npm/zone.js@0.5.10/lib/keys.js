/**
 * Creates keys for `private` properties on exposed objects to minimize interactions with other codebases.
 */

function create(name) {
  // `Symbol` implementation is broken in Chrome 39.0.2171, do not use them even if they are available
  return '_zone$' + name;
}

var commonKeys = {
  addEventListener: create('addEventListener'),
  removeEventListener: create('removeEventListener')
};

module.exports = {
  create: create,
  common: commonKeys
};
