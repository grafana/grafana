importScripts('../../dist/system.src.js');

System.paths['typescript'] = '../../node_modules/typescript/lib/typescript.js';
System.meta['typescript'] = { format: 'global', exports: 'ts' };
System.transpiler = 'typescript';

System.normalizeSync('test');

System.import('es6-and-amd.js').then(function(m) {
  postMessage({
    amd: m.amd_module,
    es6: m.es6_module
  });
}, function(err) {
  console.error(err);
});
