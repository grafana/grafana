import { ValueMapping, MappingType, ValueMappingResult } from '../types';

type TimeSeriesValue = string | number | null;

// TODO investigate this sorting and why it's needed, move to migration?
// const getAllFormattedValueMappings = (valueMappings: ValueMapping[], value: TimeSeriesValue) => {
//   const allFormattedValueMappings = valueMappings.reduce((allValueMappings, valueMapping) => {
//     if (valueMapping.type === MappingType.ValueToText) {
//       allValueMappings = addValueToTextMappingText(allValueMappings, valueMapping as ValueMap, value);
//     } else if (valueMapping.type === MappingType.RangeToText) {
//       allValueMappings = addRangeToTextMappingText(allValueMappings, valueMapping as RangeMap, value);
//     }

//     return allValueMappings;
//   }, [] as ValueMapping[]);

//   allFormattedValueMappings.sort((t1, t2) => {
//     return t1.id - t2.id;
//   });

//   return allFormattedValueMappings;
// };

export function getValueMappingResult(
  valueMappings: ValueMapping[],
  value: TimeSeriesValue
): ValueMappingResult | null {
  for (const vm of valueMappings) {
    switch (vm.type) {
      case MappingType.ValueToText:
        const result = vm.map[value ?? 'null'];
        if (result) {
          return result;
        }
        break;
      case MappingType.RangeToText:
        if (value === null || value === undefined) {
          continue;
        }

        const valueAsNumber = parseFloat(value as string);
        const fromAsNumber = parseFloat(vm.from as string);
        const toAsNumber = parseFloat(vm.to as string);

        if (isNaN(valueAsNumber) || isNaN(fromAsNumber) || isNaN(toAsNumber)) {
          continue;
        }

        if (valueAsNumber >= fromAsNumber && valueAsNumber <= toAsNumber) {
          return vm.result;
        }
    }
  }

  return null;
}

// Ref https://stackoverflow.com/a/58550111
export function isNumeric(num: any) {
  return (typeof num === 'number' || (typeof num === 'string' && num.trim() !== '')) && !isNaN(num as number);
}
