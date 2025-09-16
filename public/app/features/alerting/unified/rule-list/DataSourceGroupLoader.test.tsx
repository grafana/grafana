import { render, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { DataSourceInstanceSettings } from '@grafana/data';
import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';
import { DataSourceRuleGroupIdentifier, DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';
import { PromRuleGroupDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';
import { createViewLinkV2 } from '../utils/misc';
import { fromRulerRuleAndGroupIdentifierV2 } from '../utils/rule-id';

import { DataSourceGroupLoader } from './DataSourceGroupLoader';
import { createViewLinkFromIdentifier } from './DataSourceRuleListItem';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleExternalWrite]);

setupMswServer();

const ui = {
  ruleItem: (ruleName: string | RegExp) => byRole('treeitem', { name: ruleName }),
  editButton: byRole('link', { name: 'Edit' }),
  moreButton: byRole('button', { name: 'More' }),
};

const vanillaPromDs = alertingFactory.dataSource.vanillaPrometheus().build();
const mimirDs = alertingFactory.dataSource.mimir().build();

describe('DataSourceGroupLoader', () => {
  const promRuleSource = getDataSourceIdentifier(vanillaPromDs);
  const mimirRuleSource = getDataSourceIdentifier(mimirDs);

  describe('Vanilla Prometheus', () => {
    const promGroup = alertingFactory.prometheus.group.build({
      file: 'test-namespace',
      rules: [
        alertingFactory.prometheus.rule.build({ name: 'prom-only-rule-1' }),
        alertingFactory.prometheus.rule.build({ name: 'prom-only-rule-2' }),
        alertingFactory.prometheus.rule.build({ name: 'prom-only-rule-3' }),
      ],
    });
    const groupIdentifier = getPromGroupIdentifier(promRuleSource, promGroup);

    it('should render a list of rules for data sources without ruler', async () => {
      setPrometheusRules(vanillaPromDs, [promGroup]);
      render(<DataSourceGroupLoader groupIdentifier={groupIdentifier} />);

      const ruleListItems = await ui.ruleItem(/prom-only-rule/).findAll();
      expect(ruleListItems).toHaveLength(3);

      promGroup.rules.forEach((rule, index) => {
        const ruleLink = within(ruleListItems[index]).getByRole('link', { name: `prom-only-rule-${index + 1}` });
        expect(ruleLink).toHaveAttribute('href', expect.stringContaining(createViewLinkV2(groupIdentifier, rule)));
      });
    });

    it('should not render rule action buttons', async () => {
      setPrometheusRules(vanillaPromDs, [promGroup]);
      render(<DataSourceGroupLoader groupIdentifier={groupIdentifier} />);

      const ruleListItems = await ui.ruleItem(/prom-only-rule/).findAll();
      expect(ruleListItems).toHaveLength(3);

      ruleListItems.forEach((ruleListItem) => {
        expect(ui.editButton.query(ruleListItem)).not.toBeInTheDocument();
        expect(ui.moreButton.query(ruleListItem)).not.toBeInTheDocument();
      });
    });
  });

  describe('Ruler-enabled data sources', () => {
    const rulerRule = alertingFactory.ruler.alertingRule.build({ alert: 'mimir-rule-1' });
    const rulerOnlyRule = alertingFactory.ruler.alertingRule.build({ alert: 'mimir-only-rule' });
    alertingFactory.ruler.group.build(
      { name: 'mimir-group', rules: [rulerRule, rulerOnlyRule] },
      { transient: { addToNamespace: 'mimir-namespace' } }
    );
    const promGroup = alertingFactory.prometheus.group.build({
      name: 'mimir-group',
      file: 'mimir-namespace',
      rules: [
        alertingFactory.prometheus.rule.fromRuler(rulerRule).build(),
        alertingFactory.prometheus.rule.build({ name: 'prom-only-rule' }),
      ],
    });
    const groupIdentifier = getPromGroupIdentifier(mimirRuleSource, promGroup);

    beforeEach(() => {
      setPrometheusRules(mimirDs, [promGroup]);
    });

    it('should render a list of rules for data sources with ruler', async () => {
      render(<DataSourceGroupLoader groupIdentifier={groupIdentifier} />);

      const ruleListItems = await ui.ruleItem(/mimir-rule/).findAll();
      expect(ruleListItems).toHaveLength(1);

      const ruleLink = within(ruleListItems[0]).getByRole('link', { name: 'mimir-rule-1' });
      expect(ruleLink).toHaveAttribute('href', expect.stringContaining(getRuleLink(groupIdentifier, rulerRule)));
    });

    it('should render Edit and More buttons for rules that are present in ruler and prometheus', async () => {
      render(<DataSourceGroupLoader groupIdentifier={groupIdentifier} />);

      const mimirRule1 = await ui.ruleItem(/mimir-rule/).find();

      expect(await ui.editButton.find(mimirRule1)).toBeInTheDocument();
      expect(await ui.moreButton.find(mimirRule1)).toBeInTheDocument();
    });

    it('should render creating state if a rules is only present in ruler', async () => {
      render(<DataSourceGroupLoader groupIdentifier={groupIdentifier} />);

      const mimirOnlyItem = await ui.ruleItem(/mimir-only-rule/).find();
      expect(within(mimirOnlyItem).getByLabelText('Creating')).toBeInTheDocument();
    });

    it('should render deleting state if a rule is only present in prometheus', async () => {
      render(<DataSourceGroupLoader groupIdentifier={groupIdentifier} />);

      const promOnlyItem = await ui.ruleItem(/prom-only-rule/).find();
      expect(within(promOnlyItem).getByLabelText('Deleting')).toBeInTheDocument();
    });
  });
});

function getPromGroupIdentifier(
  promRuleSource: DataSourceRulesSourceIdentifier,
  group: PromRuleGroupDTO
): DataSourceRuleGroupIdentifier {
  return {
    rulesSource: promRuleSource,
    groupName: group.name,
    namespace: { name: group.file },
    groupOrigin: 'datasource',
  };
}

function getDataSourceIdentifier(dataSource: DataSourceInstanceSettings): DataSourceRulesSourceIdentifier {
  return {
    uid: dataSource.uid,
    name: dataSource.name,
    ruleSourceType: 'datasource',
  };
}

function getRuleLink(groupIdentifier: DataSourceRuleGroupIdentifier, rulerRule: RulerRuleDTO) {
  return createViewLinkFromIdentifier(fromRulerRuleAndGroupIdentifierV2(groupIdentifier, rulerRule));
}
