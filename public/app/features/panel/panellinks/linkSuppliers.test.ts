import { applyFieldOverrides, createTheme, DataFrameView, dateTime, FieldDisplay, toDataFrame } from '@grafana/data';

import { TemplateSrv } from '../../templating/template_srv';

import { getFieldLinksSupplier } from './linkSuppliers';
import { getLinkSrv, LinkService, LinkSrv, setLinkSrv } from './link_srv';

// We do not need more here and TimeSrv is hard to setup fully.
jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRangeForUrl() {
      const from = dateTime().subtract(1, 'h');
      const to = dateTime();
      return { from, to, raw: { from, to } };
    },
  }),
}));

describe('getFieldLinksSupplier', () => {
  let originalLinkSrv: LinkService;
  let templateSrv = new TemplateSrv();
  beforeAll(() => {
    const linkService = new LinkSrv();
    originalLinkSrv = getLinkSrv();

    setLinkSrv(linkService);
  });

  afterAll(() => {
    setLinkSrv(originalLinkSrv);
  });

  it('links to items on the row', () => {
    const data = applyFieldOverrides({
      data: [
        toDataFrame({
          name: 'Hello Templates',
          refId: 'ZZZ',
          fields: [
            { name: 'Time', values: [1, 2, 3] },
            {
              name: 'Power',
              values: [100.2000001, 200, 300],
              config: {
                unit: 'kW',
                decimals: 3,
                displayName: 'TheTitle',
              },
            },
            {
              name: 'Last',
              values: ['a', 'b', 'c'],
              config: {
                links: [
                  {
                    title: 'By Name',
                    url: 'http://go/${__data.fields.Power}',
                  },
                  {
                    title: 'By Index',
                    url: 'http://go/${__data.fields[1]}',
                  },
                  {
                    title: 'By Title',
                    url: 'http://go/${__data.fields[TheTitle]}',
                  },
                  {
                    title: 'Numeric Value',
                    url: 'http://go/${__data.fields.Power.numeric}',
                  },
                  {
                    title: 'Text (no suffix)',
                    url: 'http://go/${__data.fields.Power.text}',
                  },
                  {
                    title: 'Unknown Field',
                    url: 'http://go/${__data.fields.XYZ}',
                  },
                  {
                    title: 'Data Frame name',
                    url: 'http://go/${__data.name}',
                  },
                  {
                    title: 'Data Frame refId',
                    url: 'http://go/${__data.refId}',
                  },
                ],
              },
            },
          ],
        }),
      ],
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      replaceVariables: (val: string) => val,
      timeZone: 'utc',
      theme: createTheme(),
    })[0];

    const rowIndex = 0;
    const colIndex = data.fields.length - 1;
    const field = data.fields[colIndex];
    const fieldDisp: FieldDisplay = {
      name: 'hello',
      field: field.config,
      view: new DataFrameView(data),
      rowIndex,
      colIndex,
      display: field.display!(field.values.get(rowIndex)),
      hasLinks: true,
    };

    const supplier = getFieldLinksSupplier(fieldDisp);
    const links = supplier?.getLinks(templateSrv.replace.bind(templateSrv)).map((m) => {
      return {
        title: m.title,
        href: m.href,
      };
    });
    expect(links).toMatchInlineSnapshot(`
      [
        {
          "href": "http://go/100.200%20kW",
          "title": "By Name",
        },
        {
          "href": "http://go/100.200%20kW",
          "title": "By Index",
        },
        {
          "href": "http://go/100.200%20kW",
          "title": "By Title",
        },
        {
          "href": "http://go/100.2000001",
          "title": "Numeric Value",
        },
        {
          "href": "http://go/100.200",
          "title": "Text (no suffix)",
        },
        {
          "href": "http://go/\${__data.fields.XYZ}",
          "title": "Unknown Field",
        },
        {
          "href": "http://go/Hello%20Templates",
          "title": "Data Frame name",
        },
        {
          "href": "http://go/ZZZ",
          "title": "Data Frame refId",
        },
      ]
    `);
  });
});
