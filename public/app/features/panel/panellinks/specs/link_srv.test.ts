import { FieldType, locationUtil, toDataFrame, VariableOrigin } from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { getTimeSrv, setTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { variableAdapters } from 'app/features/variables/adapters';
import { createQueryVariableAdapter } from 'app/features/variables/query/adapter';

import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';
import { updateConfig } from '../../../../core/config';
import { getDataFrameVars, LinkSrv } from '../link_srv';

jest.mock('app/core/core', () => ({
  appEvents: {
    subscribe: () => {},
  },
}));

describe('linkSrv', () => {
  let linkSrv: LinkSrv;
  let templateSrv: TemplateSrv;
  let originalTimeService: TimeSrv;

  function initLinkSrv() {
    const _dashboard: any = {
      time: { from: 'now-6h', to: 'now' },
      getTimezone: jest.fn(() => 'browser'),
      timeRangeUpdated: () => {},
    };

    const timeSrv = new TimeSrv({} as any);
    timeSrv.init(_dashboard);
    timeSrv.setTime({ from: 'now-1h', to: 'now' });
    _dashboard.refresh = false;
    setTimeSrv(timeSrv);

    templateSrv = initTemplateSrv('key', [
      { type: 'query', name: 'home', current: { value: '127.0.0.1' } },
      { type: 'query', name: 'server1', current: { value: '192.168.0.100' } },
    ]);

    setTemplateSrv(templateSrv);

    linkSrv = new LinkSrv();
  }

  beforeAll(() => {
    originalTimeService = getTimeSrv();
    variableAdapters.register(createQueryVariableAdapter());
  });

  beforeEach(() => {
    initLinkSrv();

    jest.resetAllMocks();
  });

  afterAll(() => {
    setTimeSrv(originalTimeService);
  });

  describe('getDataLinkUIModel', () => {
    describe('built in variables', () => {
      it('should not trim white space from data links', () => {
        expect(
          linkSrv.getDataLinkUIModel(
            {
              title: 'White space',
              url: 'www.google.com?query=some query',
            },
            (v) => v,
            {}
          ).href
        ).toEqual('www.google.com?query=some query');
      });

      it('should remove new lines from data link', () => {
        expect(
          linkSrv.getDataLinkUIModel(
            {
              title: 'New line',
              url: 'www.google.com?query=some\nquery',
            },
            (v) => v,
            {}
          ).href
        ).toEqual('www.google.com?query=somequery');
      });
    });

    describe('sanitization', () => {
      const url = "javascript:alert('broken!);";
      it.each`
        disableSanitizeHtml | expected
        ${true}             | ${url}
        ${false}            | ${'about:blank'}
      `(
        "when disable disableSanitizeHtml set to '$disableSanitizeHtml' then result should be '$expected'",
        ({ disableSanitizeHtml, expected }) => {
          updateConfig({
            disableSanitizeHtml,
          });

          const link = linkSrv.getDataLinkUIModel(
            {
              title: 'Any title',
              url,
            },
            (v) => v,
            {}
          ).href;

          expect(link).toBe(expected);
        }
      );
    });

    describe('Building links with root_url set', () => {
      it.each`
        url                 | appSubUrl     | expected
        ${'/d/XXX'}         | ${'/grafana'} | ${'/grafana/d/XXX'}
        ${'/grafana/d/XXX'} | ${'/grafana'} | ${'/grafana/d/XXX'}
        ${'d/whatever'}     | ${'/grafana'} | ${'d/whatever'}
        ${'/d/XXX'}         | ${''}         | ${'/d/XXX'}
        ${'/grafana/d/XXX'} | ${''}         | ${'/grafana/d/XXX'}
        ${'d/whatever'}     | ${''}         | ${'d/whatever'}
      `(
        "when link '$url' and config.appSubUrl set to '$appSubUrl' then result should be '$expected'",
        ({ url, appSubUrl, expected }) => {
          locationUtil.initialize({
            config: { appSubUrl } as any,
            getVariablesUrlParams: (() => {}) as any,
            getTimeRangeForUrl: (() => {}) as any,
          });

          const link = linkSrv.getDataLinkUIModel(
            {
              title: 'Any title',
              url,
            },
            (v) => v,
            {}
          ).href;

          expect(link).toBe(expected);
        }
      );
    });
  });

  describe('getAnchorInfo', () => {
    it('returns variable values for variable names in link.href and link.tooltip', () => {
      jest.spyOn(linkSrv, 'getLinkUrl');
      jest.spyOn(templateSrv, 'replace');

      expect(linkSrv.getLinkUrl).toBeCalledTimes(0);
      expect(templateSrv.replace).toBeCalledTimes(0);

      const link = linkSrv.getAnchorInfo({
        type: 'link',
        icon: 'dashboard',
        tags: [],
        url: '/graph?home=$home',
        title: 'Visit home',
        tooltip: 'Visit ${home:raw}',
      });

      expect(linkSrv.getLinkUrl).toBeCalledTimes(1);
      expect(templateSrv.replace).toBeCalledTimes(3);
      expect(link).toStrictEqual({ href: '/graph?home=127.0.0.1', title: 'Visit home', tooltip: 'Visit 127.0.0.1' });
    });
  });

  describe('getLinkUrl', () => {
    it('converts link urls', () => {
      const linkUrl = linkSrv.getLinkUrl({
        url: '/graph',
      });
      const linkUrlWithVar = linkSrv.getLinkUrl({
        url: '/graph?home=$home',
      });

      expect(linkUrl).toBe('/graph');
      expect(linkUrlWithVar).toBe('/graph?home=127.0.0.1');
    });

    it('appends current dashboard time range if keepTime is true', () => {
      const anchorInfoKeepTime = linkSrv.getLinkUrl({
        keepTime: true,
        url: '/graph',
      });

      expect(anchorInfoKeepTime).toBe('/graph?from=now-1h&to=now');
    });

    it('adds all variables to the url if includeVars is true', () => {
      const anchorInfoIncludeVars = linkSrv.getLinkUrl({
        includeVars: true,
        url: '/graph',
      });

      expect(anchorInfoIncludeVars).toBe('/graph?var-home=127.0.0.1&var-server1=192.168.0.100');
    });

    it('respects config disableSanitizeHtml', () => {
      const anchorInfo = {
        url: 'javascript:alert(document.domain)',
      };

      expect(linkSrv.getLinkUrl(anchorInfo)).toBe('about:blank');

      updateConfig({
        disableSanitizeHtml: true,
      });

      expect(linkSrv.getLinkUrl(anchorInfo)).toBe(anchorInfo.url);
    });
  });
});

describe('getDataFrameVars', () => {
  describe('when called with a DataFrame that contains fields without nested path', () => {
    it('then it should return correct suggestions', () => {
      const frame = toDataFrame({
        name: 'indoor',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'temperature', type: FieldType.number, values: [10, 11, 12] },
        ],
      });

      const suggestions = getDataFrameVars([frame]);

      expect(suggestions).toEqual([
        {
          value: '__data.fields.time',
          label: 'time',
          documentation: `Formatted value for time on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: '__data.fields.temperature',
          label: 'temperature',
          documentation: `Formatted value for temperature on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields[0]`,
          label: `Select by index`,
          documentation: `Enter the field order`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields.temperature.numeric`,
          label: `Show numeric value`,
          documentation: `the numeric field value`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields.temperature.text`,
          label: `Show text value`,
          documentation: `the text value`,
          origin: VariableOrigin.Fields,
        },
      ]);
    });
  });

  describe('when called with a DataFrame that contains fields with nested path', () => {
    it('then it should return correct suggestions', () => {
      const frame = toDataFrame({
        name: 'temperatures',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'temperature.indoor', type: FieldType.number, values: [10, 11, 12] },
        ],
      });

      const suggestions = getDataFrameVars([frame]);

      expect(suggestions).toEqual([
        {
          value: '__data.fields.time',
          label: 'time',
          documentation: `Formatted value for time on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: '__data.fields["temperature.indoor"]',
          label: 'temperature.indoor',
          documentation: `Formatted value for temperature.indoor on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields[0]`,
          label: `Select by index`,
          documentation: `Enter the field order`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["temperature.indoor"].numeric`,
          label: `Show numeric value`,
          documentation: `the numeric field value`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["temperature.indoor"].text`,
          label: `Show text value`,
          documentation: `the text value`,
          origin: VariableOrigin.Fields,
        },
      ]);
    });
  });

  describe('when called with a DataFrame that contains fields with displayName', () => {
    it('then it should return correct suggestions', () => {
      const frame = toDataFrame({
        name: 'temperatures',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'temperature.indoor', type: FieldType.number, values: [10, 11, 12] },
        ],
      });

      frame.fields[1].config = { ...frame.fields[1].config, displayName: 'Indoor Temperature' };

      const suggestions = getDataFrameVars([frame]);

      expect(suggestions).toEqual([
        {
          value: '__data.fields.time',
          label: 'time',
          documentation: `Formatted value for time on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: '__data.fields["Indoor Temperature"]',
          label: 'Indoor Temperature',
          documentation: `Formatted value for Indoor Temperature on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields[0]`,
          label: `Select by index`,
          documentation: `Enter the field order`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["Indoor Temperature"].numeric`,
          label: `Show numeric value`,
          documentation: `the numeric field value`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["Indoor Temperature"].text`,
          label: `Show text value`,
          documentation: `the text value`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["Indoor Temperature"]`,
          label: `Select by title`,
          documentation: `Use the title to pick the field`,
          origin: VariableOrigin.Fields,
        },
      ]);
    });
  });

  describe('when called with a DataFrame that contains fields with duplicate names', () => {
    it('then it should ignore duplicates', () => {
      const frame = toDataFrame({
        name: 'temperatures',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'temperature.indoor', type: FieldType.number, values: [10, 11, 12] },
          { name: 'temperature.outdoor', type: FieldType.number, values: [20, 21, 22] },
        ],
      });

      frame.fields[1].config = { ...frame.fields[1].config, displayName: 'Indoor Temperature' };
      // Someone makes a mistake when renaming a field
      frame.fields[2].config = { ...frame.fields[2].config, displayName: 'Indoor Temperature' };

      const suggestions = getDataFrameVars([frame]);

      expect(suggestions).toEqual([
        {
          value: '__data.fields.time',
          label: 'time',
          documentation: `Formatted value for time on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: '__data.fields["Indoor Temperature"]',
          label: 'Indoor Temperature',
          documentation: `Formatted value for Indoor Temperature on the same row`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields[0]`,
          label: `Select by index`,
          documentation: `Enter the field order`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["Indoor Temperature"].numeric`,
          label: `Show numeric value`,
          documentation: `the numeric field value`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["Indoor Temperature"].text`,
          label: `Show text value`,
          documentation: `the text value`,
          origin: VariableOrigin.Fields,
        },
        {
          value: `__data.fields["Indoor Temperature"]`,
          label: `Select by title`,
          documentation: `Use the title to pick the field`,
          origin: VariableOrigin.Fields,
        },
      ]);
    });
  });

  describe('when called with multiple DataFrames', () => {
    it('it should not return any suggestions', () => {
      const frame1 = toDataFrame({
        name: 'server1',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 11, 12] },
        ],
      });

      const frame2 = toDataFrame({
        name: 'server2',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 11, 12] },
        ],
      });

      const suggestions = getDataFrameVars([frame1, frame2]);

      expect(suggestions).toEqual([]);
    });
  });
});
