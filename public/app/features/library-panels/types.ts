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

/** @deprecated use LibraryPanel */
export interface LibraryElementDTO extends LibraryPanel {}

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
  elements: LibraryPanel[];
  perPage: number;
  page: number;
}

export interface PanelModelWithLibraryPanel extends PanelModel {
  libraryPanel: LibraryPanel;
}

export type DispatchResult = (dispatch: Dispatch<AnyAction>) => void;
