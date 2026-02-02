// BMC file
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';

export const FEATURE_FLAG_CONFIGURABLE_LINK = 'configurablelink';

export interface CustomConfiguration {
  docLink: string;
  supportLink: string;
  communityLink: string;
  videoLink: string;
  queryType?: string;
}

export const DefaultCustomConfiguration: CustomConfiguration = {
  communityLink: 'https://communities.bmc.com',
  docLink: 'https://docs.bmc.com/xwiki/bin/view/Helix-Common-Services/Dashboards-Reports/BMC-Helix-Dashboards/BHD261',
  supportLink: 'https://www.bmc.com/support',
  videoLink: 'https://www.youtube.com/watch?v=KvL1x6ZSNsc',
  queryType: 'event',
};

class CustomConfigurationSvc {
  getCustomConfiguration = async () => {
    if (!contextSrv.isSignedIn) {
      return DefaultCustomConfiguration;
    }
    try {
      const data = await backendSrv.get('api/org/configuration');
      return this.prepareCustomConfiguration(data);
    } catch (e) {
      console.error(e);
      return DefaultCustomConfiguration;
    }
  };

  setCustomConfiguration = async (config: CustomConfiguration) => {
    if (!contextSrv.isSignedIn) {
      return;
    }
    if (!getFeatureStatus(FEATURE_FLAG_CONFIGURABLE_LINK)) {
      return await backendSrv.put('/api/org/configuration', { queryType: config.queryType });
    }
    return await backendSrv.put('/api/org/configuration', config);
  };

  private prepareCustomConfiguration = (config: CustomConfiguration): CustomConfiguration => {
    const { communityLink, docLink, supportLink, videoLink, queryType } = DefaultCustomConfiguration;
    const queryTypeValue = !config.queryType || config.queryType === '' ? queryType : config.queryType;

    if (!getFeatureStatus(FEATURE_FLAG_CONFIGURABLE_LINK)) {
      return {
        ...DefaultCustomConfiguration,
        queryType: queryTypeValue,
      };
    }
    return {
      docLink: !config.docLink || config.docLink === '' ? docLink : config.docLink,
      supportLink: !config.supportLink || config.supportLink === '' ? supportLink : config.supportLink,
      communityLink: !config.communityLink || config.communityLink === '' ? communityLink : config.communityLink,
      videoLink: !config.videoLink || config.videoLink === '' ? videoLink : config.videoLink,
      queryType: queryTypeValue,
    };
  };

  getDashboardsHealth = async (): Promise<any> => {
    const response = await backendSrv.get(`/api/health`);
    return response;
  };
}

export const customConfigSrv = new CustomConfigurationSvc();
