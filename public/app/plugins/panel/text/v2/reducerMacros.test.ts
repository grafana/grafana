import { readsSeriesByName } from './reducerMacros';

describe('readsSeriesByName', () => {
  it.each([
    {
      name: 'a series in double quotes',
      content: '- **CPU**: ${__data.series["CPU"]:reduce:lastNotNull}',
      reads: true,
    },
    { name: 'a series in single quotes', content: `\${__data.series['{job="api"}']:reduce:max}`, reads: true },
    { name: 'a field of the current frame', content: '${__data.fields.CPU:reduce:lastNotNull}', reads: false },
    { name: 'a series without a reducer', content: '${__data.series["CPU"]}', reads: false },
    { name: 'text that only mentions series', content: 'Every __data.series reading', reads: false },
  ])('is $reads for $name', ({ content, reads }) => {
    expect(readsSeriesByName(content)).toBe(reads);
  });
});
