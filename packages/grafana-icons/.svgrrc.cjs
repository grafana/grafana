/**
 * Reference: https://react-svgr.com/docs/options/
 */
module.exports = {
  icon: '{dir}/[name].gen.js',
  typescript: true,
  jsxRuntime: 'automatic',
  outDir: './src/icons-gen',
  template: require('./templates/icon.cjs'),
  indexTemplate: require('./templates/index.cjs'),
  memo: true,
  svgoConfig: {
    plugins: [
      // Sanitise the SVGs
      'removeScriptElement',
    ],
  },
  jsx: {
    babelConfig: {
      plugins: [
        // Remove fill and id attributes from SVG child elements
        [
          '@svgr/babel-plugin-remove-jsx-attribute',
          {
            elements: ['path', 'g', 'clipPath'],
            attributes: ['id', 'fill'],
          },
        ],
      ],
    },
  },
};
