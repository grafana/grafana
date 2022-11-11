import { AnyAction } from '@reduxjs/toolkit';
import { Dispatch } from 'react';

import { PanelModel } from '../dashboard/state';

export enum LibraryElementKind {
  Panel = 1,
  Variable,
}

export enum LibraryElementConnectionKind {
  Dashboard = 1,
}

export interface LibraryElementConnectionDTO {
  id: number;
  kind: LibraryElementConnectionKind;
  elementId: number;
  connectionId: number;
  connectionUid: string;
  created: string;
  createdBy: LibraryElementDTOMetaUser;
}

export interface LibraryElementsSearchResult {
  totalCount: number;
  elements: LibraryElementDTO[];
  perPage: number;
  page: number;
}

export interface LibraryElementDTO {
  id: number;
  orgId: number;
  folderId: number;
  uid: string;
  name: string;
  kind: LibraryElementKind;
  type: string;
  description: string;
  model: any;
  version: number;
  meta: LibraryElementDTOMeta;
}

export interface LibraryElementDTOMeta {
  folderName: string;
  folderUid: string;
  connectedDashboards: number;
  created: string;
  updated: string;
  createdBy: LibraryElementDTOMetaUser;
  updatedBy: LibraryElementDTOMetaUser;
}

export interface LibraryElementDTOMetaUser {
  id: number;
  name: string;
  avatarUrl: string;
}

export interface LibraryPanelRef {
  name: string;
  uid: string;
}

export interface PanelModelWithLibraryPanel extends PanelModel {
  libraryPanel: LibraryElementDTO;
}

export type DispatchResult = (dispatch: Dispatch<AnyAction>) => void;
