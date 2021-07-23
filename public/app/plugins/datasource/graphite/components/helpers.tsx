import { FuncDefs } from '../gfunc';
import { forEach, sortBy } from 'lodash';
import { SelectableValue } from '@grafana/data';

export function mapFuncDefsToSelectables(funcDefs: FuncDefs): Array<SelectableValue<string>> {
  const categories: any = {};

  forEach(funcDefs, (funcDef) => {
    if (!funcDef.category) {
      return;
    }
    if (!categories[funcDef.category]) {
      categories[funcDef.category] = { label: funcDef.category, value: funcDef.category, options: [] };
    }
    categories[funcDef.category].options.push({
      label: funcDef.name,
      value: funcDef.name,
    });
  });

  return sortBy(categories, 'label');
}
