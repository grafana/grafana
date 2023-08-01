import { CircularDataFrame, FieldType } from '@grafana/data';

import * as ResultTransformer from './liveStreamsResultTransformer';
import { LokiTailResponse } from './types';

describe('loki result transformer', () => {
  describe('appendResponseToBufferedData', () => {
    it('should return a dataframe with ts in iso format', () => {
      const tailResponse: LokiTailResponse = {
        streams: [
          {
            stream: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
            },
            values: [
              [
                '1581519914265798400',
                't=2020-02-12T15:04:51+0000 lvl=info msg="Starting Grafana" logger=server version=6.7.0-pre commit=6f09bc9fb4 branch=issue-21929 compiled=2020-02-11T20:43:28+0000',
              ],
            ],
          },
        ],
      };

      const data = new CircularDataFrame({ capacity: 1 });
      data.addField({ name: 'ts', type: FieldType.time, config: { displayName: 'Time' } });
      data.addField({ name: 'line', type: FieldType.string }).labels = { job: 'grafana' };
      data.addField({ name: 'id', type: FieldType.string });

      ResultTransformer.appendResponseToBufferedData(tailResponse, data);
      expect(data.get(0)).toEqual({
        ts: '2020-02-12T15:05:14.265Z',
        line: 't=2020-02-12T15:04:51+0000 lvl=info msg="Starting Grafana" logger=server version=6.7.0-pre commit=6f09bc9fb4 branch=issue-21929 compiled=2020-02-11T20:43:28+0000',
        id: '07f0607c-04ee-51bd-8a0c-fc0f85d37489',
      });
    });

    it('should always generate unique ids for logs', () => {
      const tailResponse: LokiTailResponse = {
        streams: [
          {
            stream: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
            },
            values: [
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 1"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 1"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 2"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Not dupplicated"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 1"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 2"'],
            ],
          },
        ],
      };

      const data = new CircularDataFrame({ capacity: 6 });
      data.addField({ name: 'ts', type: FieldType.time, config: { displayName: 'Time' } });
      data.addField({ name: 'line', type: FieldType.string }).labels = { job: 'grafana' };
      data.addField({ name: 'id', type: FieldType.string });
      data.refId = 'C';

      ResultTransformer.appendResponseToBufferedData(tailResponse, data);
      expect(data.get(0).id).toEqual('C_75e72b25-8589-5f99-8d10-ccb5eb27c1b4');
      expect(data.get(1).id).toEqual('C_75e72b25-8589-5f99-8d10-ccb5eb27c1b4_1');
      expect(data.get(2).id).toEqual('C_3ca99d6b-3ab5-5970-93c0-eb3c9449088e');
      expect(data.get(3).id).toEqual('C_ec9bea1d-70cb-556c-8519-d5d6ae18c004');
      expect(data.get(4).id).toEqual('C_75e72b25-8589-5f99-8d10-ccb5eb27c1b4_2');
      expect(data.get(5).id).toEqual('C_3ca99d6b-3ab5-5970-93c0-eb3c9449088e_1');
    });
  });
});
