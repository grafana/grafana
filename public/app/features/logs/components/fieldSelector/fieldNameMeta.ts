// Field metadata shared by the logs table field selector (used by both the Explore logs table
// and the logs table panel). Relocated here from the former Explore LogsTableWrap component.

type ActiveFieldMeta = {
  active: false;
  index: undefined; // if undefined the column is not selected
};

type InactiveFieldMeta = {
  active: true;
  index: number; // if undefined the column is not selected
};

type GenericMeta = {
  percentOfLinesWithLabel: number;
  type?: 'BODY_FIELD' | 'TIME_FIELD';
};

export type FieldNameMeta = (InactiveFieldMeta | ActiveFieldMeta) & GenericMeta;

type FieldName = string;
export type FieldNameMetaStore = Record<FieldName, FieldNameMeta>;
