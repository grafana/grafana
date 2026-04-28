import { type AnyAction } from '@reduxjs/toolkit';
import { type Dispatch } from 'react';

import { type LibraryPanel, type LibraryElementDTOMetaUser } from '@grafana/schema';

import { type PanelModel } from '../dashboard/state/PanelModel';

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
