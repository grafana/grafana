import { Configuration } from 'webpack';

import config from '@grafana/plugin-configs/webpack.config';

// config. .resolve.fallback = {
//   // @ts-ignore
//   ...config.resolve.fallback,

//   stream: require.resolve('stream-browserify'),
// };

// const config2 = async (env: Record<string, unknown>): Promise<Configuration> => {
//   return config(env).then((r) => {
//     if (r !== undefined && r.resolve !== undefined) {
//       r.resolve.fallback = {
//         ...r?.resolve?.fallback,
//         stream: require.resolve('stream-browserify'),
//         events: require.resolve('events/'),
//         string_decoder: require.resolve('string_decoder/'),
//         buffer: require.resolve('buffer/'),
//       };
//     }
//     return r;
//   });
// };

// config. .resolve.fallback = {
//   // @ts-ignore
//   ...config.resolve.fallback,

//   stream: require.resolve('stream-browserify'),
// };

// const config2 = async (env: Record<string, unknown>): Promise<Configuration> => {
//   return config(env).then((r) => {
//     if (r !== undefined && r.resolve !== undefined) {
//       r.resolve.fallback = {
//         ...r?.resolve?.fallback,
//         stream: require.resolve('stream-browserify'),
//         events: require.resolve('events/'),
//         string_decoder: require.resolve('string_decoder/'),
//         buffer: require.resolve('buffer/'),
//       };
//     }
//     return r;
//   });
// };

// config. .resolve.fallback = {
//   // @ts-ignore
//   ...config.resolve.fallback,

//   stream: require.resolve('stream-browserify'),
// };

// const config2 = async (env: Record<string, unknown>): Promise<Configuration> => {
//   return config(env).then((r) => {
//     if (r !== undefined && r.resolve !== undefined) {
//       r.resolve.fallback = {
//         ...r?.resolve?.fallback,
//         stream: require.resolve('stream-browserify'),
//         events: require.resolve('events/'),
//         string_decoder: require.resolve('string_decoder/'),
//         buffer: require.resolve('buffer/'),
//       };
//     }
//     return r;
//   });
// };

// config. .resolve.fallback = {
//   // @ts-ignore
//   ...config.resolve.fallback,

//   stream: require.resolve('stream-browserify'),
// };

const config2 = config(process.env).then((r) => {
  if (r !== undefined && r.resolve !== undefined) {
    r.resolve.fallback = {
      ...r?.resolve?.fallback,
      stream: require.resolve('stream-browserify'),
      events: require.resolve('events/'),
      string_decoder: require.resolve('string_decoder/'),
      buffer: require.resolve('buffer/'),
    };
  }
  return r;
});

export default config2;

// module.exports.getWebpackConfig = (config: { resolve: any }, options: any) => ({
//   ...config,
//   resolve: {
//     ...config.resolve,
//     fallback: {
//       os: require.resolve('os-browserify/browser'),
//       stream: require.resolve('stream-browserify'),
//       timers: require.resolve('timers-browserify'),
//     },
//   },
// });
