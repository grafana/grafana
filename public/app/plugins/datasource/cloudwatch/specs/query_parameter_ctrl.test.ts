import { CloudWatchQueryParameterCtrl } from '../query_parameter_ctrl';
import { uiSegmentSrv } from 'app/core/services/segment_srv';

describe('QueryParameterCtrl', () => {
  const ctx = {
    ctrl: new CloudWatchQueryParameterCtrl(
      { target: {} },
      {},
      new uiSegmentSrv({ trustAsHtml: html => html }, { highlightVariablesAsHtml: () => { } }),
      {},
      {}
    )
  } as any;

  describe('renderTargetFull', () => {
    it('should generate correct targetFull', () => {
      const targets = [
        {
          refId: 'A',
          id: 'id1',
          region: 'us-east-1',
          namespace: 'AWS/EC2',
          metricName: 'CPUUtilization',
          statistics: [
            'Average'
          ]
        },
        {
          refId: 'B',
          id: 'id2',
          expression: 'id1*2',
        },
        {
          refId: 'C',
          id: 'id3',
          expression: 'id2*2',
        },
        {
          refId: 'D',
          id: 'id4',
          region: 'us-west-1',
          namespace: 'AWS/EC2',
          metricName: 'CPUUtilization',
          statistics: [
            'Average'
          ]
        },
      ];
      const target: any = {
        refId: 'C',
        id: 'id3',
        expression: 'id2*2',
      };
      ctx.ctrl.renderTargetFull(target, targets);
      expect(target.targetFull.length).toBe(3);
      expect(target.targetFull[0].refId).toBe('A');
      expect(target.targetFull[0].region).toBe('us-east-1');
      expect(target.targetFull[1].refId).toBe('B');
      expect(target.targetFull[2].refId).toBe('C');
    });
  });
});
