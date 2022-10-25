const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');
const GlobEntries = require('webpack-glob-entries');

module.exports = {
  mode: 'production',
  entry: GlobEntries('./src/*test*.ts'), // Generates multiple entry for each test
  output: {
    path: path.join(__dirname, 'dist'),
    libraryTarget: 'commonjs',
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  target: 'web',
  externals: /^(k6|https?\:\/\/)(\/.*)?/,
  // Generate map files for compiled scripts
  devtool: 'source-map',
  stats: {
    colors: true,
  },
  plugins: [
    // Copy assets to the destination folder
    // see `src/post-file-test.ts` for an test example using an asset
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'assets'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  optimization: {
    // Don't minimize, as it's not used in the browser
    minimize: false,
  },
};
