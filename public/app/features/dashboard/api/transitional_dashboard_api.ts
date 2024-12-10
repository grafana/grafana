import { UrlQueryMap } from '@grafana/data';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { SaveDashboardResponseDTO, DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { ResponseTransformers } from './ResponseTransformers';
import { DashboardWithAccessInfo, DashboardAPI } from './types';
import { isDashboardResource } from './utils';

/**
 * TransitionalDashboardAPI wraps a V2 API implementation and ensures V1 format output
 * This allows gradual migration of components to V2 while maintaining backwards compatibility
 */
export class TransitionalDashboardAPI implements DashboardAPI<DashboardDTO> {
  constructor(private impl: DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec>>) { }

  async getDashboardDTO(uid: string, params?: UrlQueryMap): Promise<DashboardDTO> {
    // Get response from underlying implementation (v0 or v2) from k8s
    const result = await this.impl.getDashboardDTO(uid, params);

    // Always return V1 format
    return ResponseTransformers.ensureV1Response(result);
  }

  async saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    // Call underlying implementation
    const result = await this.impl.saveDashboard(options);

    // Transform response if needed
    if (isDashboardResource(result)) {
      return ResponseTransformers.ensureV1Response(result);
    }

    return result;
  }

  async deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    // Delete operations don't need transformation
    return this.impl.deleteDashboard(uid, showSuccessAlert);
  }
}
