import type { Event } from '../types.mjsex.mjs';

function makeMarkdownTable(properties: Array<Record<string, string | undefined>>): string {
  const keys = Object.keys(properties[0]);

  const header = `| ${keys.join(' | ')} |`;
  const border = `| ${keys.map((header) => '-'.padEnd(header.length, '-')).join(' | ')} |`;

  const rows = properties.map((property) => {
    const columns = keys.map((key) => {
      const value = property[key] ?? '';
      return String(value).replace(/\|/g, '\\|');
    });

    return '| ' + columns.join(' | ') + ' |';
  });

  return [header, border, ...rows].join('\n');
}

export function formatEventAsMarkdown(event: Event): string {
  const preparedProperties =
    event.properties?.map((property) => {
      return {
        name: property.name,
        type: '`' + property.type + '`',
        description: property.description,
      };
    }) ?? [];

  const propertiesTable = event.properties ? makeMarkdownTable(preparedProperties) : '';

  let eventMarkdown = `
### ${event.name}

${event.description}
`;

  if (event.properties) {
    eventMarkdown += `

#### Properties

${propertiesTable}
`;
  }
  return eventMarkdown;
}

export function formatEventsAsMarkdown(events: Event[]): string {
  const markdownPerEvent = events.map(formatEventAsMarkdown).join('\n');

  return `
# Analytics report

This report contains all the analytics events that are defined in the project.

## Events

${markdownPerEvent}
`;
}
