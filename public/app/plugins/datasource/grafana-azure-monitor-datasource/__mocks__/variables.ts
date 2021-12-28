import { CustomVariableModel, initialVariableModelState, VariableHide } from 'app/features/variables/types';

export const subscriptionsVariable: CustomVariableModel = {
  ...initialVariableModelState,
  id: 'subs',
  name: 'subs',
  index: 3,
  current: { value: ['sub-foo', 'sub-baz'], text: 'sub-foo + sub-baz', selected: true },
  options: [
    { selected: true, value: 'sub-foo', text: 'sub-foo' },
    { selected: false, value: 'sub-bar', text: 'sub-bar' },
    { selected: true, value: 'sub-baz', text: 'sub-baz' },
  ],
  multi: true,
  includeAll: false,
  query: '',
  hide: VariableHide.dontHide,
  type: 'custom',
};

export const singleVariable: CustomVariableModel = {
  ...initialVariableModelState,
  id: 'var1',
  name: 'var1',
  index: 0,
  current: { value: 'var1-foo', text: 'var1-foo', selected: true },
  options: [{ value: 'var1-foo', text: 'var1-foo', selected: true }],
  multi: false,
  includeAll: false,
  query: '',
  hide: VariableHide.dontHide,
  type: 'custom',
};

export const multiVariable: CustomVariableModel = {
  ...initialVariableModelState,
  id: 'var3',
  name: 'var3',
  index: 2,
  current: { value: ['var3-foo', 'var3-baz'], text: 'var3-foo + var3-baz', selected: true },
  options: [
    { selected: true, value: 'var3-foo', text: 'var3-foo' },
    { selected: false, value: 'var3-bar', text: 'var3-bar' },
    { selected: true, value: 'var3-baz', text: 'var3-baz' },
  ],
  multi: true,
  includeAll: false,
  query: '',
  hide: VariableHide.dontHide,
  type: 'custom',
};
