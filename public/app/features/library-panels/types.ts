import { AnyAction } from '@reduxjs/toolkit';
import { Dispatch } from 'react';

import { LibraryPanel } from '@grafana/schema';
import { LibraryElementDTOMetaUser } from '@grafana/schema/src/raw/librarypanel/x/librarypanel_types.gen';

import { PanelModel } from '../dashboard/state';

export enum LibraryElementKind {
  Panel = 1,
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

export interface LibraryElementDTO extends LibraryPanel {}

export interface LibraryPanelRef {
  name: string;
  uid: string;
}

export interface PanelModelWithLibraryPanel extends PanelModel {
  libraryPanel: LibraryElementDTO;
}

export type DispatchResult = (dispatch: Dispatch<AnyAction>) => void;
