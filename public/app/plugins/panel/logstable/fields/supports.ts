import { type Field } from '@grafana/data/dataframe';
import { getFieldDisplayName } from '@grafana/data/field';

export function doesFieldSupportAdHocFiltering(field: Field, timeFieldName: string, bodyFieldName: string): boolean {
  const unsupportedFields = [timeFieldName, bodyFieldName];
  return !unsupportedFields.includes(getFieldDisplayName(field));
}

export function doesFieldSupportInspector(field: Field) {
  return false;
}
