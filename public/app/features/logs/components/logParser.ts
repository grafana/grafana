import {
  type DataFrame,
  type Field,
  type FieldWithIndex,
  type LinkModel,
  type LogRowModel,
  type ScopedVars,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { safeStringifyValue } from 'app/core/utils/explore';
import { type ExploreFieldLinkModel } from 'app/features/explore/utils/links';
import { type GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { parseLogsFrame } from '../logsFrame';

export type FieldDef = {
  keys: string[];
  values: string[];
  links?: Array<LinkModel<Field>> | ExploreFieldLinkModel[];
  fieldIndex: number;
};

/**
 * Returns all fields for log row which consists of fields we parse from the message itself and additional fields
 * found in the dataframe (they may contain links).
 */
export const getAllFields = (row: LogRowModel, getFieldLinks?: GetFieldLinksFn) => {
  return getDataframeFields(row, getFieldLinks);
};

/**
 * A log line may contain many links that would all need to go on their own logs detail row
 * This iterates through and creates a FieldDef (row) per link.
 */
export const createLogLineLinks = (hiddenFieldsWithLinks: FieldDef[]): FieldDef[] => {
  let fieldsWithLinksFromVariableMap: FieldDef[] = [];
  hiddenFieldsWithLinks.forEach((linkField) => {
    linkField.links?.forEach((link: LinkModel | ExploreFieldLinkModel) => {
      if ('variables' in link && link.variables.length > 0) {
        // convert ExploreFieldLinkModel to LinkModel by omitting variables field
        const fieldDefFromLink: LinkModel = {
          href: link.href,
          title: link.title,
          origin: link.origin,
          onClick: link.onClick,
          target: link.target,
        };
        const variableKeys = link.variables.map((variable) => {
          const varName = variable.variableName;
          const fieldPath = variable.fieldPath ? `.${variable.fieldPath}` : '';
          return `${varName}${fieldPath}`;
        });
        const variableValues = link.variables.map((variable) => (variable.found ? variable.value : ''));
        fieldsWithLinksFromVariableMap.push({
          keys: variableKeys,
          values: variableValues,
          links: [fieldDefFromLink],
          fieldIndex: linkField.fieldIndex,
        });
      }
    });
  });
  return fieldsWithLinksFromVariableMap;
};

/**
 * creates fields from the dataframe-fields, adding data-links, when field.config.links exists
 */
export const getDataframeFields = (row: LogRowModel, getFieldLinks?: GetFieldLinksFn): FieldDef[] => {
  const nonEmptyVisibleFields = getNonEmptyVisibleFields(row);
  return nonEmptyVisibleFields.map((field) => {
    const vars: ScopedVars = {
      __labels: {
        text: t('logs.get-dataframe-fields.vars.text.labels', 'Labels'),
        value: {
          tags: { ...row.labels },
        },
      },
    };
    const links = getFieldLinks ? getFieldLinks(field, row.rowIndex, row.dataFrame, vars) : [];
    const fieldVal = field.values[row.rowIndex];
    const outputVal =
      typeof fieldVal === 'string' || typeof fieldVal === 'number' ? fieldVal.toString() : safeStringifyValue(fieldVal);
    return {
      keys: [field.name],
      values: [outputVal],
      links: links,
      fieldIndex: field.index,
    };
  });
};

type VisOptions = {
  keepTimestamp?: boolean;
  keepBody?: boolean;
};

// return the fields (their indices to be exact) that should be visible
// based on the logs dataframe structure
function getVisibleFieldIndices(frame: DataFrame, opts: VisOptions): Set<number> {
  const logsFrame = parseLogsFrame(frame);
  if (logsFrame === null) {
    // should not really happen
    return new Set();
  }

  // we want to show every "extra" field
  const visibleFieldIndices = new Set(logsFrame.extraFields.map((f) => f.index));

  // we always show the severity field
  if (logsFrame.severityField !== null) {
    visibleFieldIndices.add(logsFrame.severityField.index);
  }

  if (opts.keepBody) {
    visibleFieldIndices.add(logsFrame.bodyField.index);
  }

  if (opts.keepTimestamp) {
    visibleFieldIndices.add(logsFrame.timeField.index);
  }

  return visibleFieldIndices;
}

// Memoization cache for getVisibleFieldIndices results to avoid re-processing the same DataFrame structure
// WeakMap ensures automatic garbage collection when DataFrames are no longer referenced
const visibleFieldIndicesCache = new WeakMap<DataFrame, Set<number>>();
function getCachedVisibleFieldIndices(frame: DataFrame): Set<number> {
  if (!visibleFieldIndicesCache.has(frame)) {
    visibleFieldIndicesCache.set(frame, getVisibleFieldIndices(frame, {}));
  }
  return visibleFieldIndicesCache.get(frame)!;
}

// Optimized version of separateVisibleFields() to only return visible fields for getAllFields()
function getNonEmptyVisibleFields(row: LogRowModel): FieldWithIndex[] {
  const frame = row.dataFrame;
  const visibleFieldIndices = getCachedVisibleFieldIndices(frame);
  const visibleFields: FieldWithIndex[] = [];
  for (let index = 0; index < frame.fields.length; index++) {
    const field = frame.fields[index];
    // ignore empty fields
    if (field.values[row.rowIndex] == null) {
      continue;
    }
    // hidden fields are always hidden
    if (field.config.custom?.hidden) {
      continue;
    }

    // fields with data-links are visible
    if ((field.config.links && field.config.links.length > 0) || visibleFieldIndices.has(index)) {
      visibleFields.push({ ...field, index });
    }
  }
  return visibleFields;
}
