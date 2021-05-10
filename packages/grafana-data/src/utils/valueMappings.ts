import { ValueMapping, MappingType, ValueMappingResult } from '../types';

type TimeSeriesValue = string | number | null;

export function getValueMappingResult(
  valueMappings: ValueMapping[],
  value: TimeSeriesValue
): ValueMappingResult | null {
  for (const vm of valueMappings) {
    switch (vm.type) {
      case MappingType.ValueToText:
        if (value === null || value === undefined) {
          continue;
        }

        const result = vm.options[value];
        if (result) {
          return result;
        }

        break;
      case MappingType.RangeToText:
        if (value === null || value === undefined) {
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
      case MappingType.NullToText:
        if (vm.options.match === 'null' && (value === null || value === undefined)) {
          return vm.options.result;
        }
        if (vm.options.match === 'nan' && isNaN(value as number)) {
          return vm.options.result;
        }
        if (vm.options.match === 'null-nan' && (value === null || value === undefined || value === Number.NaN)) {
          return vm.options.result;
        }
    }
  }

  return null;
}

// Ref https://stackoverflow.com/a/58550111
export function isNumeric(num: any) {
  return (typeof num === 'number' || (typeof num === 'string' && num.trim() !== '')) && !isNaN(num as number);
}
