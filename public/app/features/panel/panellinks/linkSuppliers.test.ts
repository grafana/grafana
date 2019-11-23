import { getLinksFromLogsField } from './linkSuppliers';
import { ArrayVector, dateTime, Field, FieldType } from '@grafana/data';
import { getLinkSrv, LinkService, LinkSrv, setLinkSrv } from './link_srv';
import { TemplateSrv } from '../../templating/template_srv';
import { TimeSrv } from '../../dashboard/services/TimeSrv';

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
            url: 'domain.com/${__value.raw}',
          },
          {
            title: 'title2',
            url: 'anotherdomain.sk/${__value.raw}',
          },
        ],
      },
      values: new ArrayVector([1, 2, 3]),
    };
    const links = getLinksFromLogsField(field, 2);
    expect(links.length).toBe(2);
    expect(links[0].href).toBe('domain.com/3');
    expect(links[1].href).toBe('anotherdomain.sk/3');
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
});
