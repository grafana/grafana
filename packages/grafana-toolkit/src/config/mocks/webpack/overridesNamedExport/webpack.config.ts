import { CustomWebpackConfigurationGetter } from '../../../webpack.plugin.config';
import _ from 'lodash';

export const getWebpackConfig: CustomWebpackConfigurationGetter = (originalConfig, options) => {
  const config = _.cloneDeep(originalConfig);
  config.name = 'customConfig';
  return config;
};
