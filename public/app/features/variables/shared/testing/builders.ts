import { initialAdHocVariableModelState } from '../../adhoc/reducer';
import { initialConstantVariableModelState } from '../../constant/reducer';
import { initialCustomVariableModelState } from '../../custom/reducer';
import { initialDataSourceVariableModelState } from '../../datasource/reducer';
import { initialIntervalVariableModelState } from '../../interval/reducer';
import { initialQueryVariableModelState } from '../../query/reducer';
import { initialTextBoxVariableModelState } from '../../textbox/reducer';

import { AdHocVariableBuilder } from './adHocVariableBuilder';
import { DatasourceVariableBuilder } from './datasourceVariableBuilder';
import { IntervalVariableBuilder } from './intervalVariableBuilder';
import { MultiVariableBuilder } from './multiVariableBuilder';
import { OptionsVariableBuilder } from './optionsVariableBuilder';
import { QueryVariableBuilder } from './queryVariableBuilder';
import { TextBoxVariableBuilder } from './textboxVariableBuilder';

export const adHocBuilder = () => new AdHocVariableBuilder(initialAdHocVariableModelState);
export const intervalBuilder = () => new IntervalVariableBuilder(initialIntervalVariableModelState);
export const datasourceBuilder = () => new DatasourceVariableBuilder(initialDataSourceVariableModelState);
export const queryBuilder = () => new QueryVariableBuilder(initialQueryVariableModelState);
export const textboxBuilder = () => new TextBoxVariableBuilder(initialTextBoxVariableModelState);
export const customBuilder = () => new MultiVariableBuilder(initialCustomVariableModelState);
export const constantBuilder = () => new OptionsVariableBuilder(initialConstantVariableModelState);
