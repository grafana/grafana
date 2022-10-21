// Transform es modules to prevent `SyntaxError: Cannot use import statement outside a module`
module.exports = { presets: [['@babel/preset-env', { targets: { esmodules: false, node: 'current' } }]] };
