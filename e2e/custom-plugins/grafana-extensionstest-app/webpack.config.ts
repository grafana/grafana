import baseConfig from '@grafana/plugin-configs/webpack.config';

const config = baseConfig({ ...process.env, licencePath: '../../../LICENSE' });
export default config;
