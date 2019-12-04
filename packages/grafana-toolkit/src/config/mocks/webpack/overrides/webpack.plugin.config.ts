import { CustomWebpackConfigurationGetter } from '../../../webpack.plugin.config';
import _ from 'lodash';

const overrideWebpackConfig: CustomWebpackConfigurationGetter = (originalConfig, options) => {
  const config = _.cloneDeep(originalConfig);
  config.name = 'customConfig';
  return config;
};

export = overrideWebpackConfig;
