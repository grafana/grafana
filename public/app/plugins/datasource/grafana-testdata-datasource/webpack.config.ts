import { Configuration } from 'webpack';
import config from '@grafana-plugins/shared/webpack.config';

const c = async (env: any): Promise<Configuration> => {
  return await config(env);
};

export default c;
