import { getFieldDisplayName } from '@grafana/data';
import { type Field } from '@grafana/data/dataframe';

export function doesFieldSupportAdHocFiltering(field: Field, timeFieldName: string, bodyFieldName: string): boolean {
  const unsupportedFields = [timeFieldName, bodyFieldName];
  return !unsupportedFields.includes(getFieldDisplayName(field));
}

export function doesFieldSupportInspector(field: Field) {
  return false;
}
