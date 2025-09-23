import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { EntitlementsResponse, Entitlement } from './Entitlements.types';

const BASE_URL = '/v1/platform';

const EntitlementsService = {
  async list(token?: CancelToken): Promise<Entitlement[]> {
    const { entitlements = [] } = await api.get<EntitlementsResponse, {}>(
      `${BASE_URL}/organization/entitlements`,
      false,
      { cancelToken: token }
    );
    return entitlements.map(
      ({
        number,
        name,
        summary,
        tier,
        total_units,
        unlimited_units,
        support_level,
        software_families,
        start_date,
        end_date,
        platform,
      }): Entitlement => {
        const { security_advisor, config_advisor } = platform;
        return {
          number,
          name,
          summary,
          tier,
          totalUnits: total_units,
          unlimitedUnits: unlimited_units,
          supportLevel: support_level,
          softwareFamilies: software_families,
          startDate: new Date(start_date).toLocaleDateString('en-GB'),
          endDate: new Date(end_date).toLocaleDateString('en-GB'),
          platform: {
            securityAdvisor: security_advisor,
            configAdvisor: config_advisor,
          },
        };
      }
    );
  },
};

export default EntitlementsService;
