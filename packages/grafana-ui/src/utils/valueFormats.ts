type ValueFormatter = (value: number, decimals?: number, scaledDecimals?: number) => string;

interface ValueFormat {
  name: string;
  id: string;
  fn: ValueFormatter;
}

interface ValueFormatCategory {
  name: string;
  formats: ValueFormat[];
}

interface ValueFormatterIndex {
  [id: string]: ValueFormatter;
}

// Globals & formats cache
let categories: ValueFormatCategory[] = [];
const index: ValueFormatterIndex = {};
let hasBuildIndex = false;

function toFixed(value: number, decimals?: number): string {
  if (value === null) {
    return '';
  }

  const factor = decimals ? Math.pow(10, Math.max(0, decimals)) : 1;
  const formatted = String(Math.round(value * factor) / factor);

  // if exponent return directly
  if (formatted.indexOf('e') !== -1 || value === 0) {
    return formatted;
  }

  // If tickDecimals was specified, ensure that we have exactly that
  // much precision; otherwise default to the value's own precision.
  if (decimals != null) {
    const decimalPos = formatted.indexOf('.');
    const precision = decimalPos === -1 ? 0 : formatted.length - decimalPos - 1;
    if (precision < decimals) {
      return (precision ? formatted : formatted + '.') + String(factor).substr(1, decimals - precision);
    }
  }

  return formatted;
}

function buildFormats() {
  categories = [
    {
      name: 'none',
      formats: [
        {
          name: 'short',
          id: 'short',
          fn: toFixed,
        },
      ],
    },
  ];

  for (const cat of categories) {
    for (const format of cat.formats) {
      index[format.id] = format.fn;
    }
  }

  hasBuildIndex = true;
}

export function getValueFormat(id: string): ValueFormatter {
  if (!hasBuildIndex) {
    buildFormats();
  }

  return index[id];
}

export function getValueFormatterIndex(): ValueFormatterIndex {
  if (!hasBuildIndex) {
    buildFormats();
  }

  return index;
}

export function getUnitFormats() {
  if (!hasBuildIndex) {
    buildFormats();
  }

  return categories.map(cat => {
    return {
      text: cat.name,
      submenu: cat.formats.map(format => {
        return {
          text: format.name,
          value: format.id,
        };
      }),
    };
  });
}
