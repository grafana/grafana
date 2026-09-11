import { type ValueFormatCategory, type ValueFormatterIndex, type ValueFormatter } from '../types/valueFormats';

import { booleanValueFormatter, simpleCountUnit, toFixedUnit } from './baseFormatters';
import { getCategories } from './categories';
import { toDateTimeValueFormatter } from './dateTimeFormatters';
import { getOffsetFromSIPrefix, SIPrefix, currency, fullCurrency } from './symbolFormatters';

// Globals & formats cache
let categories: ValueFormatCategory[] = [];
const index: ValueFormatterIndex = {};
let hasBuiltIndex = false;

function buildFormats() {
  categories = getCategories();

  for (const cat of categories) {
    for (const format of cat.formats) {
      index[format.id] = format.fn;
    }
  }

  // Resolve units pointing to old IDs
  [{ from: 'farenheit', to: 'fahrenheit' }].forEach((alias) => {
    const f = index[alias.to];
    if (f) {
      index[alias.from] = f;
    }
  });

  hasBuiltIndex = true;
}

export function getValueFormat(id?: string | null): ValueFormatter {
  if (!id) {
    return toFixedUnit('');
  }

  if (!hasBuiltIndex) {
    buildFormats();
  }

  const fmt = index[id];

  if (!fmt && id) {
    let idx = id.indexOf(':');

    if (idx > 0) {
      const key = id.substring(0, idx);
      const sub = id.substring(idx + 1);

      if (key === 'prefix') {
        return toFixedUnit(sub, true);
      }

      if (key === 'suffix') {
        return toFixedUnit(sub, false);
      }

      if (key === 'time') {
        return toDateTimeValueFormatter(sub);
      }

      if (key === 'si') {
        const offset = getOffsetFromSIPrefix(sub.charAt(0));
        const unit = offset === 0 ? sub : sub.substring(1);
        return SIPrefix(unit, offset);
      }

      if (key === 'count') {
        return simpleCountUnit(sub);
      }

      // Supported formats:
      // currency:$           -> scaled currency ($1.2K)
      // currency:financial:$ -> full currency ($1,234)
      // currency:financial:€:suffix -> full currency with suffix (1,234€)
      if (key === 'currency') {
        const keySplit = sub.split(':');

        if (keySplit[0] === 'financial' && keySplit.length >= 2) {
          const symbol = keySplit[1];
          if (!symbol) {
            return toFixedUnit(''); // fallback for empty symbol
          }
          const asSuffix = keySplit[2] === 'suffix';
          return fullCurrency(symbol, asSuffix);
        } else {
          return currency(sub);
        }
      }

      if (key === 'bool') {
        idx = sub.indexOf('/');
        if (idx >= 0) {
          const t = sub.substring(0, idx);
          const f = sub.substring(idx + 1);
          return booleanValueFormatter(t, f);
        }
        return booleanValueFormatter(sub, '-');
      }
    }

    return toFixedUnit(id);
  }

  return fmt;
}

export function getValueFormatterIndex(): ValueFormatterIndex {
  if (!hasBuiltIndex) {
    buildFormats();
  }

  return index;
}

export function getValueFormats() {
  if (!hasBuiltIndex) {
    buildFormats();
  }

  return categories.map((cat) => {
    return {
      text: cat.name,
      submenu: cat.formats.map((format) => {
        return {
          text: format.name,
          value: format.id,
        };
      }),
    };
  });
}
