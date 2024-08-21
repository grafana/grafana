import baseConfig from '@grafana/plugin-configs/webpack.config';

const config = baseConfig({ ...process.env, licencePath: '../../../' });
export default config;
