import { ValueMapping, MappingType, ValueMappingResult, SpecialValueMatch } from '../types';

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

      case MappingType.SpecialValue:
        switch (vm.options.match) {
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
