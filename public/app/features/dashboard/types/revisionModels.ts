export const VERSIONS_FETCH_LIMIT = 10;

export interface RevisionModel {
  id: number;
  checked: boolean;
  uid: string;
  version: number;
  created: string;
  createdBy: string;
  message: string;
  // sine this is only used for diffing, we can use object instead of dashboard v1/v2 spec
  data: object;
}

export type DecoratedRevisionModel = RevisionModel & {
  createdDateString: string;
  ageString: string;
};
