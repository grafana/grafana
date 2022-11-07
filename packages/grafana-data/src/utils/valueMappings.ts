import { getActiveThreshold } from '../field';
import { stringToJsRegex } from '../text/string';
import {
  MappingType,
  SpecialValueMatch,
  ThresholdsConfig,
  ValueMap,
  ValueMapping,
  ValueMappingResult,
  SpecialValueOptions,
} from '../types';

export function getValueMappingResult(valueMappings: ValueMapping[], value: any): ValueMappingResult | null {
  for (const vm of valueMappings) {
    switch (vm.type) {
      case MappingType.ValueToText:
        if (value == null) {
          continue;
        }

        const result = vm.options[value];
        if (result) {
          return result;
        }

        break;

      case MappingType.RangeToText:
        if (value == null) {
          continue;
        }

        const valueAsNumber = parseFloat(value as string);
        if (isNaN(valueAsNumber)) {
          continue;
        }

        const isNumFrom = !isNaN(vm.options.from!);
        if (isNumFrom && valueAsNumber < vm.options.from!) {
          continue;
        }

        const isNumTo = !isNaN(vm.options.to!);
        if (isNumTo && valueAsNumber > vm.options.to!) {
          continue;
        }

        return vm.options.result;

      case MappingType.RegexToText:
        if (value == null) {
          continue;
        }

        if (typeof value !== 'string') {
          continue;
        }

        const regex = stringToJsRegex(vm.options.pattern);
        if (value.match(regex)) {
          const res = { ...vm.options.result };

          if (res.text != null) {
            res.text = value.replace(regex, vm.options.result.text || '');
          }

          return res;
        }

      case MappingType.SpecialValue:
        switch ((vm.options as SpecialValueOptions).match) {
          case SpecialValueMatch.Null: {
            if (value == null) {
              return vm.options.result;
            }
            break;
          }
          case SpecialValueMatch.NaN: {
            if (isNaN(value as any)) {
              return vm.options.result;
            }
            break;
          }
          case SpecialValueMatch.NullAndNaN: {
            if (isNaN(value as any) || value == null) {
              return vm.options.result;
            }
            break;
          }
          case SpecialValueMatch.True: {
            if (value === true || value === 'true') {
              return vm.options.result;
            }
            break;
          }
          case SpecialValueMatch.False: {
            if (value === false || value === 'false') {
              return vm.options.result;
            }
            break;
          }
          case SpecialValueMatch.Empty: {
            if (value === '') {
              return vm.options.result;
            }
            break;
          }
        }
    }
  }

  return null;
}

// Ref https://stackoverflow.com/a/58550111
export function isNumeric(num: any) {
  return (typeof num === 'number' || (typeof num === 'string' && num.trim() !== '')) && !isNaN(num as number);
}

/**
 * @deprecated use MappingType instead
 * @internal
 */
export enum LegacyMappingType {
  ValueToText = 1,
  RangeToText = 2,
}

/**
 * @alpha
 * Converts the old Angular value mappings to new react style
 */
export function convertOldAngularValueMappings(panel: any, migratedThresholds?: ThresholdsConfig): ValueMapping[] {
  const mappings: ValueMapping[] = [];

  // Guess the right type based on options
  let mappingType = panel.mappingType;
  if (!panel.mappingType) {
    if (panel.valueMaps && panel.valueMaps.length) {
      mappingType = 1;
    } else if (panel.rangeMaps && panel.rangeMaps.length) {
      mappingType = 2;
    }
  }
  if (mappingType === 1) {
    for (let i = 0; i < panel.valueMaps.length; i++) {
      const map = panel.valueMaps[i];
      mappings.push(
        upgradeOldAngularValueMapping(
          {
            ...map,
            id: i, // used for order
            type: MappingType.ValueToText,
          },
          panel.fieldConfig?.defaults?.thresholds || migratedThresholds
        )
      );
    }
  } else if (mappingType === 2) {
    for (let i = 0; i < panel.rangeMaps.length; i++) {
      const map = panel.rangeMaps[i];
      mappings.push(
        upgradeOldAngularValueMapping(
          {
            ...map,
            id: i, // used for order
            type: MappingType.RangeToText,
          },
          panel.fieldConfig?.defaults?.thresholds || migratedThresholds
        )
      );
    }
  }

  return mappings;
}

function upgradeOldAngularValueMapping(old: any, thresholds?: ThresholdsConfig): ValueMapping {
  const valueMaps: ValueMap = { type: MappingType.ValueToText, options: {} };
  const newMappings: ValueMapping[] = [];

  // Use the color we would have picked from thesholds
  let color: string | undefined = undefined;
  const numeric = parseFloat(old.text);
  if (thresholds && !isNaN(numeric)) {
    const level = getActiveThreshold(numeric, thresholds.steps);
    if (level && level.color) {
      color = level.color;
    }
  }

  switch (old.type) {
    case LegacyMappingType.ValueToText:
    case MappingType.ValueToText:
      if (old.value != null) {
        if (old.value === 'null') {
          newMappings.push({
            type: MappingType.SpecialValue,
            options: {
              match: SpecialValueMatch.Null,
              result: { text: old.text, color },
            },
          });
        } else {
          valueMaps.options[String(old.value)] = {
            text: old.text,
            color,
          };
        }
      }
      break;
    case LegacyMappingType.RangeToText:
    case MappingType.RangeToText:
      if (old.from === 'null' || old.to === 'null') {
        newMappings.push({
          type: MappingType.SpecialValue,
          options: {
            match: SpecialValueMatch.Null,
            result: { text: old.text, color },
          },
        });
      } else {
        newMappings.push({
          type: MappingType.RangeToText,
          options: {
            from: +old.from,
            to: +old.to,
            result: { text: old.text, color },
          },
        });
      }
      break;
  }

  if (Object.keys(valueMaps.options).length > 0) {
    newMappings.unshift(valueMaps);
  }

  return newMappings[0];
}
