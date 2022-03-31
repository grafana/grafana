export interface Entitlement {
  number: string;
  name: string;
  summary: string;
  tier: string;
  totalUnits: string;
  unlimitedUnits: boolean;
  supportLevel: string;
  softwareFamilies: string[];
  startDate: string;
  endDate: string;
  platform: Platform;
}

export interface Platform {
  securityAdvisor: boolean;
  configAdvisor: boolean;
}

interface RawEntitlement {
  number: string;
  name: string;
  summary: string;
  tier: string;
  total_units: string;
  unlimited_units: boolean;
  support_level: string;
  software_families: string[];
  start_date: string;
  end_date: string;
  platform: RawPlatform;
}

interface RawPlatform {
  security_advisor: boolean;
  config_advisor: boolean;
}

export interface EntitlementsResponse {
  entitlements: RawEntitlement[];
}
