import { GRAFANA_RULES_SOURCE_NAME } from "../../utils/datasource";

import { shouldShowExportOption } from "./shouldShowExportOption";

describe('shouldShowExportOption function', () => {
    it('returns true when alertManagerSourceName is GRAFANA_RULES_SOURCE_NAME and canReadProvisioning is true', () => {
        const alertManagerSourceName = GRAFANA_RULES_SOURCE_NAME;
        const isDefaultPolicy = true;
        const canReadProvisioning = true;
        const result = shouldShowExportOption(alertManagerSourceName, isDefaultPolicy, canReadProvisioning);
        expect(result).toBe(true);
    });

    it('returns false when alertManagerSourceName is not GRAFANA_RULES_SOURCE_NAME', () => {
        const alertManagerSourceName = 'test';
        const isDefaultPolicy = true;
        const canReadProvisioning = true;
        const result = shouldShowExportOption(alertManagerSourceName, isDefaultPolicy, canReadProvisioning);
        expect(result).toBe(false);
    });

    it('returns false when isDefaultPolicy is false', () => {
        const alertManagerSourceName = GRAFANA_RULES_SOURCE_NAME;
        const isDefaultPolicy = false;
        const canReadProvisioning = true;
        const result = shouldShowExportOption(alertManagerSourceName, isDefaultPolicy, canReadProvisioning);
        expect(result).toBe(false);
    });

    it('returns false when canReadProvisioning is false', () => {
        const alertManagerSourceName = GRAFANA_RULES_SOURCE_NAME;
        const isDefaultPolicy = true;
        const canReadProvisioning = false;
        const result = shouldShowExportOption(alertManagerSourceName, isDefaultPolicy, canReadProvisioning);
        expect(result).toBe(false);
    });
    it('returns true when alertManagerSourceName is GRAFANA_RULES_SOURCE_NAME, isDefaultPolicy is true, and canReadProvisioning is true', () => {
        const alertManagerSourceName = GRAFANA_RULES_SOURCE_NAME;
        const isDefaultPolicy = true;
        const canReadProvisioning = true;
        const result = shouldShowExportOption(alertManagerSourceName, isDefaultPolicy, canReadProvisioning);
        expect(result).toBe(true);
    });
});
