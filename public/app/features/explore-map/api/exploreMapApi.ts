import { getBackendSrv } from '@grafana/runtime';

import { ExploreMapState } from '../state/types';

export interface ExploreMapDTO {
  uid: string;
  title: string;
  data: string; // JSON-encoded ExploreMapState
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExploreMapListItem {
  uid: string;
  title: string;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExploreMapRequest {
  title: string;
  data: ExploreMapState;
}

export interface UpdateExploreMapRequest {
  title: string;
  data: ExploreMapState;
}

export interface ExploreMapCreateResponse {
  id: number;
  uid: string;
  title: string;
  data: string;
  orgID: number;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export class ExploreMapApi {
  private baseUrl = '/api/atlas';

  async listExploreMaps(limit?: number): Promise<ExploreMapListItem[]> {
    const params = limit ? { limit } : {};
    return getBackendSrv().get(this.baseUrl, params);
  }

  async getExploreMap(uid: string): Promise<ExploreMapDTO> {
    return getBackendSrv().get(`${this.baseUrl}/${uid}`);
  }

  async createExploreMap(request: CreateExploreMapRequest): Promise<ExploreMapCreateResponse> {
    return getBackendSrv().post(this.baseUrl, {
      title: request.title,
      data: JSON.stringify(request.data),
    });
  }

  async updateExploreMap(uid: string, request: UpdateExploreMapRequest): Promise<ExploreMapDTO> {
    return getBackendSrv().put(`${this.baseUrl}/${uid}`, {
      title: request.title,
      data: JSON.stringify(request.data),
    });
  }

  async deleteExploreMap(uid: string): Promise<void> {
    return getBackendSrv().delete(`${this.baseUrl}/${uid}`);
  }
}

export const exploreMapApi = new ExploreMapApi();
