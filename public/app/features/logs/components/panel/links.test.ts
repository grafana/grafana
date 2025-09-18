import { FieldType, getDefaultTimeRange, LogsSortOrder, toDataFrame } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { createLogLine } from '../mocks/logRow';

import { getTempoTraceFromLinks } from './links';
import { LogListModel } from './processing';

describe('getTempoTraceFromLinks', () => {
  let log: LogListModel;

  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasAccessToExplore').mockReturnValue(true);

    const getFieldLinks: GetFieldLinksFn = (field, rowIndex, dataFrame, vars) => {
      return getFieldLinksForExplore({ field, rowIndex, range: getDefaultTimeRange(), dataFrame, vars });
    };

    log = createLogLine(
      {
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [1] },
            {
              name: 'Line',
              type: FieldType.string,
              values: ['log message 1 traceid=2203801e0171aa8b'],
            },
            {
              name: 'labels',
              type: FieldType.other,
              values: [
                { level: 'warn', logger: 'interceptor' },
                { method: 'POST', status: '200' },
                { kind: 'Event', stage: 'ResponseComplete' },
              ],
            },
            {
              name: 'link',
              type: FieldType.string,
              config: {
                links: [
                  {
                    internal: {
                      datasourceName: 'tempo',
                      datasourceUid: 'test',
                      query: {
                        query: '${__value.raw}',
                        queryType: 'traceql',
                      },
                    },
                    title: '',
                    url: '',
                  },
                ],
              },
              values: ['2203801e0171aa8b'],
            },
          ],
        }),
      },
      {
        escape: false,
        getFieldLinks,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        wrapLogMessage: true,
      }
    );
  });

  test('Gets the trace information from a link', () => {
    expect(getTempoTraceFromLinks(log.fields)).toEqual({
      dsUID: 'test',
      query: '2203801e0171aa8b',
      queryType: 'traceql',
    });
  });
});
