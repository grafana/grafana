import prettier from 'prettier';

import type { EventData } from './types.mts';

const makeMarkdownTable = (properties: Array<Record<string, string | undefined>>): string => {
  if (properties.length === 0) {
    return '';
  }

  const keys = Object.keys(properties[0]);

  const header = `| ${keys.join(' | ')} |`;
  const border = `| ${keys.map((header) => '-'.padEnd(header.length, '-')).join(' | ')} |`;

  const rows = properties.map((property) => {
    const columns = keys.map((key) => {
      const value = property[key] ?? '';
      return String(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    });

    return '| ' + columns.join(' | ') + ' |';
  });

  return [header, border, ...rows].join('\n');
};

export const formatEventAsMarkdown = (event: EventData): string => {
  const preparedProperties =
    event.properties?.map((property) => {
      return {
        name: property.name,
        type: '`' + property.type + '`',
        description: property.description,
      };
    }) ?? [];

  const propertiesTable = event.properties && event.properties.length > 0 ? makeMarkdownTable(preparedProperties) : '';

  const markdownRows = [
    `#### \`${event.fullEventName}\``,
    `**Description**: ${event.description}`,
    event.owner ? `**Owner:** ${event.owner}` : undefined,
    ...(event.properties ? [`**Properties**:`, propertiesTable] : []),
  ].filter(Boolean);

  return markdownRows.join('\n\n');
};

export async function formatEventsAsMarkdown(events: EventData[]): Promise<string> {
  const byFeature: Record<string, EventData[]> = {};

  for (const event of events) {
    const feature = event.feature;
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
