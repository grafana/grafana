import { SelectableValue } from '@grafana/data';

import { generateOptions } from '../../components/Form/AsyncSelectFieldCore/__mocks__/mockAsyncSelectOptions';

export const loadAsyncOptions = () =>
  new Promise<Array<SelectableValue<string>>>((resolve) => {
    setTimeout(() => {
      resolve(generateOptions());
    }, 5000);
  });
