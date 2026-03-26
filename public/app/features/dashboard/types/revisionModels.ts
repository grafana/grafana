export const VERSIONS_FETCH_LIMIT = 20;

export interface RevisionModel {
  id: number;
  checked: boolean;
  uid: string;
  version: number;
  created: string;
  createdBy: string;
  message: string;
  data: object;
}

export type DecoratedRevisionModel = RevisionModel & {
  createdDateString: string;
  ageString: string;
};
