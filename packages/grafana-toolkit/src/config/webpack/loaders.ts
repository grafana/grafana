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
  supportedExtensions.forEach(e => {
    stylesheetsPaths.forEach(p => {
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

export const hasThemeStylesheets = (root: string = process.cwd()) => {
  const stylesheetsPaths = getStylesheetPaths(root);
  const stylesheetsSummary: boolean[] = [];

  const result = stylesheetsPaths.reduce((acc, current) => {
    if (fs.existsSync(`${current}.css`) || fs.existsSync(`${current}.scss`)) {
      stylesheetsSummary.push(true);
      return acc && true;
    } else {
      stylesheetsSummary.push(false);
      return false;
    }
  }, true);

  const hasMissingStylesheets = stylesheetsSummary.filter(s => s).length === 1;

  // seems like there is one theme file defined only
  if (result === false && hasMissingStylesheets) {
    console.error('\nWe think you want to specify theme stylesheet, but it seems like there is something missing...');
    stylesheetsSummary.forEach((s, i) => {
      if (s) {
        console.log(stylesheetsPaths[i], 'discovered');
      } else {
        console.log(stylesheetsPaths[i], 'missing');
      }
    });

    throw new Error('Stylesheet missing!');
  }

  return result;
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
      loader: 'css-loader',
      options: {
        importLoaders: 1,
        sourceMap: true,
      },
    },
    {
      loader: 'postcss-loader',
      options: {
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          require('postcss-preset-env')({
            autoprefixer: { flexbox: 'no-2009', grid: true },
          }),
        ],
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
      use: [extractionLoader, ...cssLoaders, 'sass-loader'],
    },
    {
      test: /\.css$/,
      use: ['style-loader', ...cssLoaders, 'sass-loader'],
      exclude: [`${styleDir}light.css`, `${styleDir}dark.css`],
    },
    {
      test: /\.s[ac]ss$/,
      use: ['style-loader', ...cssLoaders, 'sass-loader'],
      exclude: [`${styleDir}light.scss`, `${styleDir}dark.scss`],
    },
    {
      test: /\.less$/,
      use: [
        {
          loader: 'style-loader',
        },
        ...cssLoaders,
        {
          loader: 'less-loader',
          options: {
            javascriptEnabled: true,
          },
        },
      ],
      exclude: [`${styleDir}light.less`, `${styleDir}dark.less`],
    },
  ];

  return rules;
};

export const getFileLoaders = () => {
  const shouldExtractCss = hasThemeStylesheets();

  return [
    {
      test: /\.(png|jpe?g|gif|svg)$/,
      use: [
        shouldExtractCss
          ? {
              loader: 'file-loader',
              options: {
                outputPath: '/',
                name: '[path][name].[ext]',
              },
            }
          : // When using single css import images are inlined as base64 URIs in the result bundle
            {
              loader: 'url-loader',
            },
      ],
    },
    {
      test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'file-loader',
      options: {
        publicPath: `/public/plugins/${getPluginId()}/fonts`,
        outputPath: 'fonts',
        name: '[name].[ext]',
      },
    },
  ];
};
