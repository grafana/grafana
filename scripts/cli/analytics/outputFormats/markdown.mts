import type { Event } from '../types.mts';
import prettier from 'prettier';

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

  const markdownRows = [
    `#### ${event.fullEventName}`,
    event.description,
    event.owner ? `**Owner:** ${event.owner}` : undefined,
    ...(event.properties ? [`##### Properties`, propertiesTable] : []),
  ].filter(Boolean);

  return markdownRows.join('\n\n');
}

export async function formatEventsAsMarkdown(events: Event[]): Promise<string> {
  const byFeature: Record<string, Event[]> = {};

  for (const event of events) {
    const feature = event.eventFeature;
    byFeature[feature] = byFeature[feature] ?? [];
    byFeature[feature].push(event);
  }

  const markdownPerFeature = Object.entries(byFeature)
    .map(([feature, events]) => {
      const markdownPerEvent = events.map(formatEventAsMarkdown).join('\n');

      return `
### ${feature}

${markdownPerEvent}
`;
    })
    .join('\n');

  const markdown = `
# Analytics report

This report contains all the analytics events that are defined in the project.

## Events

${markdownPerFeature}
`;

  return prettier.format(markdown, { parser: 'markdown' });
}
