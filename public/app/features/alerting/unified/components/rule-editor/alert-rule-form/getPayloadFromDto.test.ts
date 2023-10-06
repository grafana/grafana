import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { mockRulerGrafanaRule } from '../../../mocks';
import { Annotation } from '../../../utils/constants';

import { getPayloadFromDto } from './ModifyExportRuleForm';

const rule3 = mockRulerGrafanaRule(
  {
    for: '1m',
    labels: { severity: 'notcritical3', region: 'region3' },
    annotations: { [Annotation.summary]: 'This grafana rule2' },
  },
  { uid: 'uid-rule-3', title: 'Rule3', data: [] }
);

const rule1 = mockRulerGrafanaRule(
  {
    for: '1m',
    labels: { severity: 'critical', region: 'region1' },
    annotations: { [Annotation.summary]: 'This grafana rule1' },
  },
  { uid: 'uid-rule-1', title: 'Rule1', data: [] }
);

const rule2 = mockRulerGrafanaRule(
  {
    for: '1m',
    labels: { severity: 'notcritical', region: 'region2' },
    annotations: { [Annotation.summary]: 'This grafana rule2' },
  },
  { uid: 'uid-rule-2', title: 'Rule2', data: [] }
);

describe('getPayloadFromDto', () => {
  const groupDto: RulerRuleGroupDTO<RulerRuleDTO> = {
    name: 'Test Group',
    rules: [rule1, rule2, rule3],
  };

  const modifyiedGrafanaRuleDto = mockRulerGrafanaRule(
    {
      for: '1m',
      labels: { severity: 'notcritical', region: 'region2', newLabel: 'newLabel' },
      annotations: { [Annotation.summary]: 'This grafana rule2 updated' },
    },
    { uid: 'uid-rule-2', title: 'Rule2 updated', data: [] }
  );

  const modifyiedGrafanaRuleDto5 = mockRulerGrafanaRule(
    {
      for: '1m',
      labels: { severity: 'notcritical', region: 'region2', newLabel: 'newLabel' },
      annotations: { [Annotation.summary]: 'This grafana rule2 updated' },
    },
    { uid: 'uid-rule-5', title: 'Rule2 updated', data: [] }
  );

  it('should return a ModifyExportPayload with the updated rule added to a group with this rule belongs, in the same position', () => {
    const result = getPayloadFromDto(groupDto, modifyiedGrafanaRuleDto, 'uid-rule-2');
    expect(result).toMatchObject({
      name: 'Test Group',
      rules: [rule1, modifyiedGrafanaRuleDto, rule3],
    });
  });
  it('should return a ModifyExportPayload with the updated rule added to a non empty rule where this rule does not belong, in the last position', () => {
    const result = getPayloadFromDto(groupDto, modifyiedGrafanaRuleDto5, 'uid-rule-5');
    expect(result).toMatchObject({
      name: 'Test Group',
      rules: [rule1, rule2, rule3, modifyiedGrafanaRuleDto5],
    });
  });

  it('should return a ModifyExportPayload with the updated rule added to an empty group', () => {
    const emptyGroupDto: RulerRuleGroupDTO<RulerRuleDTO> = {
      name: 'Empty Group',
      rules: [],
    };
    const result = getPayloadFromDto(emptyGroupDto, modifyiedGrafanaRuleDto, 'uid-rule-2');
    expect(result).toMatchObject({
      name: 'Empty Group',
      rules: [modifyiedGrafanaRuleDto],
    });
  });
});
