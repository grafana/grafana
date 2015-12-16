var Showdown = { converter: true };

// export
if (typeof module !== 'undefined') module.exports = Showdown;

// stolen from AMD branch of underscore
// AMD define happens at the end for compatibility with AMD loaders
// that don't enforce next-turn semantics on modules.
if (typeof define === 'function' && define.amd) {
    define('tests/nameddefine.js', function() {
        return Showdown;
    });
}
define('another-define', { named: 'define' });
