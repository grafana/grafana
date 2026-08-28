import { uniqueId } from 'lodash';

import { MappingType, SpecialValueMatch, type ValueMapping } from '@grafana/data';

import { type ValueMappingEditRowModel } from './ValueMappingEditRow';

function getRowUniqueId(): string {
  return uniqueId('mapping-');
}

export function createRow(row: Partial<ValueMappingEditRowModel>): ValueMappingEditRowModel {
  return {
    type: MappingType.ValueToText,
    result: {},
    id: getRowUniqueId(),
    ...row,
  };
}

export function duplicateRow(row: Partial<ValueMappingEditRowModel>): ValueMappingEditRowModel {
  return {
    ...createRow(row),
    // provide a new unique id to the duplicated row, to preserve focus when dragging 2 duplicated rows
    id: getRowUniqueId(),
  };
}

export function editModelToSaveModel(rows: ValueMappingEditRowModel[]) {
  const mappings: ValueMapping[] = [];
  const valueMaps: ValueMapping = {
    type: MappingType.ValueToText,
    options: {},
  };

  rows.forEach((item, index) => {
    const result = {
      ...item.result,
      index,
    };

    // Set empty texts to undefined
    if (!result.text || result.text.trim().length === 0) {
      result.text = undefined;
    }

    switch (item.type) {
      case MappingType.ValueToText:
        if (item.key != null) {
          valueMaps.options[item.key] = result;
        }
        break;
      case MappingType.RangeToText: {
        const fromNum = item.from != null && String(item.from).trim() !== '' ? Number(item.from) : null;
        const toNum = item.to != null && String(item.to).trim() !== '' ? Number(item.to) : null;
        const validFrom = fromNum != null && !Number.isNaN(fromNum) ? fromNum : null;
        const validTo = toNum != null && !Number.isNaN(toNum) ? toNum : null;
        if (validFrom != null || validTo != null) {
          mappings.push({
            type: item.type,
            options: {
              from: validFrom,
              to: validTo,
              result,
            },
          });
        }
        break;
      }
      case MappingType.RegexToText:
        if (item.pattern != null) {
          mappings.push({
            type: item.type,
            options: {
              pattern: item.pattern,
              result,
            },
          });
        }
        break;
      case MappingType.SpecialValue:
        mappings.push({
          type: item.type,
          options: {
            match: item.specialMatch!,
            result,
          },
        });
    }
  });

  if (Object.keys(valueMaps.options).length > 0) {
    mappings.unshift(valueMaps);
  }
  return mappings;
}

export function buildEditRowModels(value: ValueMapping[]) {
  const editRows: ValueMappingEditRowModel[] = [];

  if (value) {
    for (const mapping of value) {
      switch (mapping.type) {
        case MappingType.ValueToText:
          for (const key in mapping.options) {
            editRows.push(
              createRow({
                type: mapping.type,
                result: mapping.options[key],
                key,
              })
            );
          }
          break;
        case MappingType.RangeToText:
          editRows.push(
            createRow({
              type: mapping.type,
              result: mapping.options.result,
              from: mapping.options.from,
              to: mapping.options.to,
            })
          );
          break;
        case MappingType.RegexToText:
          editRows.push(
            createRow({
              type: mapping.type,
              result: mapping.options.result,
              pattern: mapping.options.pattern,
            })
          );
          break;
        case MappingType.SpecialValue:
          editRows.push(
            createRow({
              type: mapping.type,
              result: mapping.options.result,
              specialMatch: mapping.options.match ?? SpecialValueMatch.Null,
            })
          );
      }
    }
  }

  // Sort by index
  editRows.sort((a, b) => {
    return (a.result.index ?? 0) > (b.result.index ?? 0) ? 1 : -1;
  });

  return editRows;
}
