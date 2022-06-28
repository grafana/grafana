import { QueryConditionInfo, QueryConditionID, QueryConditionType, toPascalCase } from '@grafana/data';
import { KeyValueVariableModel } from 'app/features/variables/types';

import { FieldValueClickConditionEditor, ValueClickConditionOptions } from './FieldValueClickConditionEditor';

const FIELD_VALUE_CLICK_VARIABLE_PREFIX = 'valueClick';

export const fieldValueClickCondition: QueryConditionInfo<ValueClickConditionOptions> = {
  id: QueryConditionID.ValueClick,
  type: QueryConditionType.Field,
  name: 'Field value click',
  description: 'When a value is clicked',
  variablePrefix: FIELD_VALUE_CLICK_VARIABLE_PREFIX,
  execute: (options, context) => {
    const drilldownTplVars = context.variables.filter(
      (arg) =>
        // disabling because we know only keyValue variables are passed to this function
        // eslint-disable-next-line
        (arg as KeyValueVariableModel).id.includes('valueClick') && (arg as KeyValueVariableModel).current.value !== ''
    );

    return (
      drilldownTplVars.filter((arg) => {
        // disabling because we know only keyValue variables are passed to this function
        // eslint-disable-next-line
        const result = (arg as KeyValueVariableModel).name.replace('valueClick', '').match(toPascalCase(options.name));

        return result;
      }).length !== 0
    );
  },
  editor: FieldValueClickConditionEditor,
  getVariableName: (options: ValueClickConditionOptions) => {
    return `${FIELD_VALUE_CLICK_VARIABLE_PREFIX}${toPascalCase(options.name)}`;
  },
};
