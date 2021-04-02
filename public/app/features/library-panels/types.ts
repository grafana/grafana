import { PanelModel } from '../dashboard/state';
import { Dispatch } from 'react';
import { AnyAction } from '@reduxjs/toolkit';

export interface LibraryPanelSearchResult {
  totalCount: number;
  libraryPanels: LibraryPanelDTO[];
  perPage: number;
  page: number;
}

export interface LibraryPanelDTO {
  id: number;
  orgId: number;
  folderId: number;
  uid: string;
  name: string;
  type: string;
  description: string;
  model: any;
  version: number;
  meta: LibraryPanelDTOMeta;
}

export interface LibraryPanelDTOMeta {
  canEdit: boolean;
  connectedDashboards: number;
  created: string;
  updated: string;
  createdBy: LibraryPanelDTOMetaUser;
  updatedBy: LibraryPanelDTOMetaUser;
}

export interface LibraryPanelDTOMetaUser {
  id: number;
  name: string;
  avatarUrl: string;
}

export type PanelModelLibraryPanel = Pick<LibraryPanelDTO, 'uid' | 'name' | 'meta' | 'version'>;

export interface PanelModelWithLibraryPanel extends PanelModel {
  libraryPanel: PanelModelLibraryPanel;
}

export type DispatchResult = (dispatch: Dispatch<AnyAction>) => void;
