import { isArray, map } from 'lodash';

import { formatRegistry } from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';

const quoteLiteral = (val: string) => {
  let quotedVal = String(val).replace(/\\/g, '\\\\');
  quotedVal = String(quotedVal).replace(/'/g, "\\\\'");
  quotedVal = String(quotedVal).replace(/\"/g, '\\"');
  return `'${quotedVal}'`;
};

formatRegistry.register({
  id: VariableFormatID.Base64,
  name: 'base64',
  description: 'Convert the value in base64 encoding',
  formatter: (value) => {
    if (typeof value === 'string') {
      return btoa(value);
    }
    return `${value}`;
  },
});
formatRegistry.register({
  id: VariableFormatID.BMCSingleQuote,
  name: 'BMC Single quote',
  description: 'BMC Single quoted values',
  formatter: (value) => {
    if (isArray(value)) {
      return map(value, (v: string) => quoteLiteral(v)).join(',');
    }

    let strVal = typeof value === 'string' ? value : String(value);
    return quoteLiteral(strVal);
  },
});

export { formatRegistry };
