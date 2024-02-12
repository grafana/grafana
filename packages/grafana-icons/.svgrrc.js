/**
 * Reference: https://react-svgr.com/docs/options/
 */
module.exports = {
  icon: true,
  typescript: true,
  jsxRuntime: 'automatic',
  outDir: './src/icons',
  template: require('./templates/icon'),
  svgoConfig: {
    plugins: ['removeScriptElement'],
  },
};
