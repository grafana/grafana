import { getLinksFromLogsField, getFieldLinksSupplier } from './linkSuppliers';
import {
  ArrayVector,
  dateTime,
  Field,
  FieldType,
  toDataFrame,
  applyFieldOverrides,
  GrafanaTheme,
  FieldDisplay,
  DataFrameView,
} from '@grafana/data';
import { getLinkSrv, LinkService, LinkSrv, setLinkSrv } from './link_srv';
import { TemplateSrv } from '../../templating/template_srv';
import { TimeSrv } from '../../dashboard/services/TimeSrv';
import { getRowDisplayValuesProxy } from './rowDisplayValuesProxy';

describe('getLinksFromLogsField', () => {
  let originalLinkSrv: LinkService;
  beforeAll(() => {
    // We do not need more here and TimeSrv is hard to setup fully.
    const timeSrvMock: TimeSrv = {
      timeRangeForUrl() {
        const from = dateTime().subtract(1, 'h');
        const to = dateTime();
        return { from, to, raw: { from, to } };
      },
    } as any;
    const linkService = new LinkSrv(new TemplateSrv(), timeSrvMock);
    originalLinkSrv = getLinkSrv();
    setLinkSrv(linkService);
  });

  afterAll(() => {
    setLinkSrv(originalLinkSrv);
  });

  it('interpolates link from field', () => {
    const field: Field = {
      name: 'test field',
      type: FieldType.number,
      config: {
        links: [
          {
            title: 'title1',
            url: 'http://domain.com/${__value.raw}',
          },
          {
            title: 'title2',
            url: 'http://anotherdomain.sk/${__value.raw}',
          },
        ],
      },
      values: new ArrayVector([1, 2, 3]),
    };
    const links = getLinksFromLogsField(field, 2);
    expect(links.length).toBe(2);
    expect(links[0].href).toBe('http://domain.com/3');
    expect(links[1].href).toBe('http://anotherdomain.sk/3');
  });

  it('handles zero links', () => {
    const field: Field = {
      name: 'test field',
      type: FieldType.number,
      config: {},
      values: new ArrayVector([1, 2, 3]),
    };
    const links = getLinksFromLogsField(field, 2);
    expect(links.length).toBe(0);
  });

  it('links to items on the row', () => {
    const data = applyFieldOverrides({
      data: [
        toDataFrame({
          fields: [
            { name: 'Time', values: [1, 2, 3] },
            {
              name: 'Power',
              values: [100.2000001, 200, 300],
              config: {
                unit: 'kW',
                decimals: 3,
              },
            },
            {
              name: 'Last',
              values: ['a', 'b', 'c'],
              config: {
                links: [
                  {
                    title: 'By Name (full display)',
                    url: 'http://go/${__row.Power}',
                  },
                  {
                    title: 'Numeric Value',
                    url: 'http://go/${__row.Power.numeric}',
                  },
                  {
                    title: 'Text (no suffix)',
                    url: 'http://go/${__row.Power.text}',
                  },
                ],
              },
            },
          ],
        }),
      ],
      fieldOptions: {
        defaults: {},
        overrides: [],
      },
      replaceVariables: (val: string) => val,
      timeZone: 'utc',
      theme: {} as GrafanaTheme,
      autoMinMax: true,
    })[0];

    // Field display set after everything is applied
    for (const field of data.fields) {
      expect(field.display).toBeDefined();
    }
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
    };

    const supplier = getFieldLinksSupplier(fieldDisp);
    const links = supplier.getLinks({}).map(m => {
      return {
        title: m.title,
        href: m.href,
      };
    });
    expect(links).toMatchInlineSnapshot(`
      Array [
        Object {
          "href": "http://go/100.200 kW",
          "title": "By Name (full display)",
        },
        Object {
          "href": "http://go/100.2000001",
          "title": "Numeric Value",
        },
        Object {
          "href": "http://go/100.200",
          "title": "Text (no suffix)",
        },
      ]
    `);

    // Test Proxies in general
    const row = getRowDisplayValuesProxy(data, 0);
    const time = row.Time;
    expect(time.numeric).toEqual(1);
    expect(time.text).toEqual('1970-01-01 00:00:00');

    // Should get to the same values by name or index
    const time2 = row[0];
    expect(time2.toString()).toEqual(time.toString());
  });
});
