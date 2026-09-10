import { createRequire } from 'node:module';
import copy from 'rollup-plugin-copy';
import svg from 'rollup-plugin-svg-import';

import { cjsOutput, entryPoint, esmOutput, plugins } from '../rollup.config.parts';

// react-data-grid is a devDependency (so nodeExternals inlines it); its bundled `styles.css` is the
// only CSS rollup actually resolves (slider/uplot stay external). Inline it as a runtime <style>.
const injectBundledCss = {
  name: 'grafana-inject-bundled-css',
  transform(code, id) {
    if (!id.endsWith('.css')) {
      return null;
    }
    const cssText = JSON.stringify(code);
    const key = JSON.stringify(`rdg-css-${id.split('/').slice(-3).join('-')}`);
    return {
      code: `
if (typeof document !== 'undefined' && !document.getElementById(${key})) {
  const el = document.createElement('style');
  el.id = ${key};
  el.textContent = ${cssText};
  document.head.appendChild(el);
}
`,
      map: { mappings: '' },
    };
  },
};

const rq = createRequire(import.meta.url);
const icons = rq('../../public/app/core/icons/cached.json');
const pkg = rq('./package.json');

const iconSrcPaths = icons.map((iconSubPath) => {
  // eslint-disable-next-line @grafana/no-restricted-img-srcs
  return `../../public/img/icons/${iconSubPath}.svg`;
});

export default [
  {
    input: entryPoint,
    plugins: [
      ...plugins,
      injectBundledCss,
      svg({ stringify: true }),
      copy({
        targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
        flatten: false,
      }),
    ],
    output: [cjsOutput(pkg, 'grafana-ui'), esmOutput(pkg, 'grafana-ui')],
    treeshake: false,
  },
  {
    input: 'src/unstable.ts',
    plugins: [
      ...plugins,
      injectBundledCss,
      svg({ stringify: true }),
      copy({
        targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
        flatten: false,
      }),
    ],
    output: [cjsOutput(pkg, 'grafana-ui'), esmOutput(pkg, 'grafana-ui')],
    treeshake: false,
  },
];
