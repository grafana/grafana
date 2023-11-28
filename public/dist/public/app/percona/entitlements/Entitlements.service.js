import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/Platform';
const EntitlementsService = {
    list(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { entitlements = [] } = yield api.post(`${BASE_URL}/SearchOrganizationEntitlements`, {}, false, token);
            return entitlements.map(({ number, name, summary, tier, total_units, unlimited_units, support_level, software_families, start_date, end_date, platform, }) => {
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
            });
        });
    },
};
export default EntitlementsService;
//# sourceMappingURL=Entitlements.service.js.map