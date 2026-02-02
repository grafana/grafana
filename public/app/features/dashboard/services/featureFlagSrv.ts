import { forOwn as _forOwn } from 'lodash';

import { config, getBackendSrv } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import {
  GrafanaFeatureDTO,
  Key_Enabled_Features,
  Key_Features_List,
  Key_Grafana_Enabled_Feature,
  TenantFeatureDTO,
} from 'app/types/features';

export function getFeatureStatus(featureName: string) {
  // if feature flag set to false, return true to allow the feature.
  if (!config.FeatureFlagEnabled) {
    return true;
  }

  // check if the feature is enabled via URL parameter
  // this is useful for testing purposes, to enable a feature without changing the local storage.
  if (config.buildInfo.env === 'development') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has(`__feature_${featureName}`)) {
      return true;
    }
  }

  // BHD_ENABLE_VAR_CACHING requires bhd-scenes feature to be enabled
  if (featureName === FEATURE_CONST.BHD_ENABLE_VAR_CACHING) {
    if (!config.featureToggles.dashboardScene) {
      return false;
    }
  }

  // if local storage exist and contain the provided feature return true (to enable the feature), otherwise return false to hide this feature.
  const KeyEnabledFeatures = localStorage.getItem(Key_Enabled_Features);
  if (KeyEnabledFeatures && KeyEnabledFeatures.includes(featureName)) {
    return true;
  } else {
    return false;
  }
}

export function loadFeatures(tenantFeature: TenantFeatureDTO[] | null) {
  let enabledFeatures: string[] = [];
  if (tenantFeature != null) {
    tenantFeature.map((feature) => {
      if (feature.Status && !enabledFeatures.includes(feature.Name)) {
        enabledFeatures.push(feature.Name);
      }
    });
  }
  localStorage.setItem(Key_Enabled_Features, JSON.stringify(enabledFeatures));
}

export async function loadGrafanaFeatures() {
  const enabledFeatures: string[] = [];
  const featureMap: { [key: string]: boolean } = {};
  let resp: GrafanaFeatureDTO[] = await getBackendSrv().get('/api/org/featurestatus');
  resp = resp.filter((item: GrafanaFeatureDTO) => {
    if (item.orgId === config.bootData.user.orgId) {
      featureMap[item.featureName] = item.status;
      return 0;
    }
    return 1;
  });
  resp.forEach((item: GrafanaFeatureDTO) => {
    if (!featureMap.hasOwnProperty(item.featureName)) {
      featureMap[item.featureName] = item.status;
    }
  });
  _forOwn(featureMap, (val: boolean, key: string) => {
    if (val) {
      enabledFeatures.push(key);
    }
  });
  localStorage.setItem(Key_Grafana_Enabled_Feature, JSON.stringify(enabledFeatures));
  localStorage.setItem(Key_Features_List, JSON.stringify(featureMap));
  return;
}

export function getGrafanaFeatureStatus(featureName: string) {
  const enabledFeatures = localStorage.getItem(Key_Grafana_Enabled_Feature);
  return enabledFeatures && enabledFeatures.includes(featureName) ? true : false;
}

export function updateFeatureStatus(data: any) {
  return getBackendSrv().put('/api/org/featurestatus', data);
}

export function getGrafanaFeaturesList() {
  const featuresList = localStorage.getItem(Key_Features_List);
  if (featuresList) {
    try {
      const fL = JSON.parse(featuresList);
      return Object.keys(fL).reduce((acc: any, cur) => {
        acc[getLocalizedFeatures(cur)] = { key: cur, val: fL[cur] };
        return acc;
      }, {});
    } catch (e) {}
  }
  return null;
}

export function getGrafanaEnabledFeatures() {
  const enabledFeatures = localStorage.getItem(Key_Grafana_Enabled_Feature);
  if (enabledFeatures) {
    try {
      return JSON.parse(enabledFeatures);
    } catch (e) {}
  }
  return null;
}

export const FEATURE_CONST = {
  snapshot: 'Snapshot',
  DASHBOARDS_SSRF_FEATURE_NAME: 'bhd-ssrf',
  bmcCrosstabColorOverrid: 'Headers color palette for BMC Cross-tab plugin',
  RBAC: 'bhd-rbac',
  EXPORT_COMPLETE_TABLE: 'Export Complete Table In PDF',
  BHD_GF_USE_DEFAULT_VARS: 'bhd_gf_use_default_vars', // No longer used but reserved
  BHD_GF_OPEN_EMPTY_PANELS: 'bhd_gf_open_empty_panels',
  BHD_ENABLE_VAR_CACHING: 'bhd_enable_var_caching', // DRJ71-18644 - Redis caching
  BHD_ENABLE_DEPENDANT_VAR_CACHING: 'bhd_enable_dependant_var_caching', // If this must be turned on, BHD_ENABLE_VAR_CACHING must also be turned on. It controls whether we allow caching for dependant variables
  BHD_DYNAMIC_REPORT_BURSTING: 'bhd_dynamic_report_bursting', // DRJ71-19432 - Dynamic Report Bursting.
};

const getLocalizedFeatures = (cur: string) => {
  switch (`${cur.toLowerCase().replace(/\s+/g, '-')}`) {
    case 'snapshot':
      return t('bmc.features-list.snapshot', 'Snapshot');
    case 'date-function-resolution-for-service-management':
      return t(
        'bmc.features-list.date-function-resolution-for-service-management',
        'Date function resolution for service management'
      );
    case 'export-complete-table-in-pdf':
      return t('bmc.features-list.export-complete-table-in-pdf', 'Export Complete Table In PDF');
    case 'skip-ootb-dashboards-during-upgrade':
      return t('bmc.features-list.skip-ootb-dashboards-during-upgrade', 'Skip OOTB dashboards during upgrade');
    case 'enable-ootb-views-for-visual-query-builder':
      return t(
        'bmc.features-list.enable-ootb-views-for-visual-query-builder',
        'Enable OOTB Views for Visual Query Builder'
      );
    default:
      return cur;
  }
};
