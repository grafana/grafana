import { classicColors } from '@grafana/data';

import { PillCellProps } from '../types';

function normalizePillValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map(stripQuotes);
  }
  if (typeof value === 'string') {
    // Try JSON parse
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) {
        return arr.map(String).map(stripQuotes);
      }
    } catch (e) {
      // Not JSON, continue
    }
    // Split by comma, but keep quoted substrings together
    // e.g. 'foo,"Tim Levett",bar' => ['foo', 'Tim Levett', 'bar']
    const regex = /(?:"([^"]*)")|(?:'([^']*)')|([^,]+)/g;
    const pills: string[] = [];
    let match;
    while ((match = regex.exec(value)) !== null) {
      const pill = match[1] || match[2] || match[3];
      if (pill && pill.trim() !== '') {
        pills.push(stripQuotes(pill.trim()));
      }
    }
    if (pills.length > 0) {
      return pills;
    }
    // Fallback: split by whitespace
    if (value.match(/\s/)) {
      return value.split(/\s+/).map(s => stripQuotes(s.trim())).filter(Boolean);
    }
    // Otherwise, treat as single pill if not empty
    if (value.trim() !== '') {
      return [stripQuotes(value.trim())];
    }
  }
  return [];
}

// Helper to strip leading/trailing quotes
function stripQuotes(str: string): string {
  return str.replace(/^['"]+|['"]+$/g, '');
}

// Utility to determine if a color is "light" or "dark" for text contrast
function isColorLight(hex: string): boolean {
  // Remove hash if present
  hex = hex.replace('#', '');
  // Convert 3-digit to 6-digit
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Perceived brightness
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export const PillCell = ({ cellOptions, value, field }: PillCellProps & { field: any }) => {
  // Use the palette from field.config.palette, fallback to classicColors
  const palette: string[] = field?.config?.palette && Array.isArray(field.config.palette) && field.config.palette.length > 0
    ? field.config.palette
    : classicColors;
  const pills = normalizePillValues(value);

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {pills.map((pill, idx) => {
        const pillColor = palette[idx % palette.length];
        const textColor = isColorLight(pillColor) ? '#222' : '#fff';
        return (
          <span
            key={idx}
            style={{
              background: pillColor,
              borderRadius: 16,
              padding: '0 12px',
              color: textColor,
              fontWeight: 500,
              fontSize: '0.95em',
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 24,
            }}
          >
            {pill}
          </span>
        );
      })}
    </div>
  );
}; 
