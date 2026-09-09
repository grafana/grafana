/* fixture-source-comment: minification must remove this */
// @ts-expect-error -- a plain UMD file with no types, deliberately untyped
import umdDep from './umdDep.js';

export function greet(name: string): string {
  console.log('log call: pure_funcs must drop this');
  console.info('info call: pure_funcs must drop this');
  console.warn('warn call: pure_funcs must keep this');
  console.error('error call: pure_funcs must keep this');
  return `hello ${name} ${umdDep.marker}`;
}
