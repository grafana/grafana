// helper function to make it easy to call this from the widget-render-code
import { TypedVariableModel } from '@grafana/data/src';

import { getTemplateVariableOptions } from './getTemplateVariableOptions';

export function withTemplateVariableOptions(
  optionsPromise: Promise<string[]>,
  wrapper: (v: TypedVariableModel) => string,
  filter?: string
): Promise<string[]> {
  let templateVariableOptions = getTemplateVariableOptions(wrapper);
  if (filter) {
    templateVariableOptions = templateVariableOptions.filter((tvo) => tvo.indexOf(filter) > -1);
  }
  return optionsPromise.then((options) => [...templateVariableOptions, ...options]);
}
