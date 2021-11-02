import { Registry } from '@grafana/data';
import { createQueryVariableAdapter } from './query/adapter';
import { createCustomVariableAdapter } from './custom/adapter';
import { createTextBoxVariableAdapter } from './textbox/adapter';
import { createConstantVariableAdapter } from './constant/adapter';
import { createDataSourceVariableAdapter } from './datasource/adapter';
import { createIntervalVariableAdapter } from './interval/adapter';
import { createAdHocVariableAdapter } from './adhoc/adapter';
import { createSystemVariableAdapter } from './system/adapter';
export var getDefaultVariableAdapters = function () { return [
    createQueryVariableAdapter(),
    createCustomVariableAdapter(),
    createTextBoxVariableAdapter(),
    createConstantVariableAdapter(),
    createDataSourceVariableAdapter(),
    createIntervalVariableAdapter(),
    createAdHocVariableAdapter(),
    createSystemVariableAdapter(),
]; };
export var variableAdapters = new Registry();
//# sourceMappingURL=adapters.js.map