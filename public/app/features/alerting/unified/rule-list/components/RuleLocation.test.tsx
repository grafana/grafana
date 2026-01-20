import { render, screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { PromApplication } from 'app/types/unified-alerting-dto';

import { NO_GROUP_PREFIX } from '../../utils/rules';

import { RuleLocation } from './RuleLocation';

const ui = {
  groupLink: (name: string) => byRole('link', { name }),
};

describe('RuleLocation', () => {
  describe('ungrouped rules', () => {
    it('should display "Ungrouped" text for groups with no_group_for_rule_ prefix', () => {
      const { container } = render(
        <RuleLocation namespace="TestNamespace" group={`${NO_GROUP_PREFIX}test-rule-uid`} application="grafana" />
      );

      expect(container).toHaveTextContent('Ungrouped');
      expect(container).not.toHaveTextContent(`${NO_GROUP_PREFIX}test-rule-uid`);
    });

    it('should render "Ungrouped" as link when groupUrl is provided', () => {
      render(
        <RuleLocation
          namespace="TestNamespace"
          group={`${NO_GROUP_PREFIX}test-rule-uid`}
          groupUrl="/alerting/grafana/namespaces/folder-123/groups/test-group/view"
          application="grafana"
        />
      );

      const link = ui.groupLink('Ungrouped').get();
      expect(link).toHaveAttribute('href', '/alerting/grafana/namespaces/folder-123/groups/test-group/view');
    });

    it('should render "Ungrouped" as text when groupUrl is not provided', () => {
      const { container } = render(
        <RuleLocation namespace="TestNamespace" group={`${NO_GROUP_PREFIX}test-rule-uid`} application="grafana" />
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(container).toHaveTextContent('Ungrouped');
    });
  });

  describe('grouped rules', () => {
    it('should display normal group name for regular groups', () => {
      const { container } = render(<RuleLocation namespace="TestNamespace" group="MyGroup" application="grafana" />);

      expect(container).toHaveTextContent('MyGroup');
      expect(container).not.toHaveTextContent('Ungrouped');
    });

    it('should render group name as link when groupUrl is provided', () => {
      render(
        <RuleLocation
          namespace="TestNamespace"
          group="MyGroup"
          groupUrl="/alerting/grafana/namespaces/folder-123/groups/MyGroup/view"
          application="grafana"
        />
      );

      const link = ui.groupLink('MyGroup').get();
      expect(link).toHaveAttribute('href', '/alerting/grafana/namespaces/folder-123/groups/MyGroup/view');
    });

    it('should render group name as text when groupUrl is not provided', () => {
      const { container } = render(<RuleLocation namespace="TestNamespace" group="MyGroup" application="grafana" />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(container).toHaveTextContent('MyGroup');
    });
  });

  describe('namespace and group display', () => {
    it('should display namespace and group correctly', () => {
      const { container } = render(<RuleLocation namespace="TestNamespace" group="MyGroup" application="grafana" />);

      expect(container).toHaveTextContent('TestNamespace');
      expect(container).toHaveTextContent('MyGroup');
    });
  });

  describe('grafana application', () => {
    it('should not render data source tooltip for grafana application', () => {
      render(<RuleLocation namespace="TestNamespace" group="MyGroup" application="grafana" />);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('datasource application', () => {
    const mockRulesSource = {
      uid: 'prometheus-1',
      name: 'Prometheus',
      ruleSourceType: 'datasource' as const,
    };

    it('should render content for datasource application', () => {
      const { container } = render(
        <RuleLocation
          namespace="TestNamespace"
          group="MyGroup"
          rulesSource={mockRulesSource}
          application={PromApplication.Prometheus}
        />
      );

      expect(container).toHaveTextContent('TestNamespace');
      expect(container).toHaveTextContent('MyGroup');
    });
  });
});
