import fs from 'fs';
import path from 'path';

import { getPluginId } from '../utils/getPluginId';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const supportedExtensions = ['css', 'scss', 'less', 'sass'];

const getStylesheetPaths = (root: string = process.cwd()) => {
  return [`${root}/src/styles/light`, `${root}/src/styles/dark`];
};

export const getStylesheetEntries = (root: string = process.cwd()) => {
  const stylesheetsPaths = getStylesheetPaths(root);
  const entries: { [key: string]: string } = {};
  supportedExtensions.forEach((e) => {
    stylesheetsPaths.forEach((p) => {
      const entryName = p.split('/').slice(-1)[0];
      if (fs.existsSync(`${p}.${e}`)) {
        if (entries[entryName]) {
          console.log(`\nSeems like you have multiple files for ${entryName} theme:`);
          console.log(entries[entryName]);
          console.log(`${p}.${e}`);
          throw new Error('Duplicated stylesheet');
        } else {
          entries[entryName] = `${p}.${e}`;
        }
      }
    });
  });

  return entries;
};

export const getStyleLoaders = () => {
  const extractionLoader = {
    loader: MiniCssExtractPlugin.loader,
    options: {
      publicPath: '../',
    },
  };

  const cssLoaders = [
    {
      loader: require.resolve('css-loader'),
      options: {
        importLoaders: 1,
        sourceMap: true,
      },
    },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        postcssOptions: {
          plugins: () => [
            require('postcss-flexbugs-fixes'),
            require('postcss-preset-env')({
              autoprefixer: { flexbox: 'no-2009', grid: true },
            }),
          ],
        },
      },
    },
  ];

  const styleDir = path.resolve(process.cwd(), 'src', 'styles') + path.sep;
  const rules = [
    {
      test: /(dark|light)\.css$/,
      use: [extractionLoader, ...cssLoaders],
    },
    {
      test: /(dark|light)\.scss$/,
      use: [extractionLoader, ...cssLoaders, require.resolve('sass-loader')],
    },
    {
      test: /\.css$/,
      use: ['style-loader', ...cssLoaders, require.resolve('sass-loader')],
      exclude: [`${styleDir}light.css`, `${styleDir}dark.css`],
    },
    {
      test: /\.s[ac]ss$/,
      use: ['style-loader', ...cssLoaders, require.resolve('sass-loader')],
      exclude: [`${styleDir}light.scss`, `${styleDir}dark.scss`],
    },
    {
      test: /\.less$/,
      use: [
        {
          loader: require.resolve('style-loader'),
        },
        ...cssLoaders,
        {
          loader: require.resolve('less-loader'),
          options: {
            lessOptions: {
              javascriptEnabled: true,
            },
          },
        },
      ],
      exclude: [`${styleDir}light.less`, `${styleDir}dark.less`],
    },
  ];

  return rules;
};

export const getFileLoaders = () => {
  return [
    {
      test: /\.(png|jpe?g|gif|svg)$/,
      type: 'asset/resource',
      generator: {
        publicPath: `public/plugins/${getPluginId()}/img/`,
        outputPath: 'img/',
      },
    },
    {
      test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
      type: 'asset/resource',
      generator: {
        publicPath: `public/plugins/${getPluginId()}/fonts/`,
        outputPath: 'fonts/',
      },
    },
  ];
};
