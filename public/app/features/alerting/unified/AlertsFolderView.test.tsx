import { render } from 'test/test-utils';
import { byTestId } from 'testing-library-selector';

import { AlertsFolderView } from './AlertsFolderView';
import { mockFolder } from './mocks';
import { alertingFactory } from './mocks/server/db';

const ui = {
  filter: {
    name: byTestId('name-filter'),
    label: byTestId('label-filter'),
  },
  ruleList: {
    row: byTestId('alert-card-row'),
  },
};

const alertingRuleBuilder = alertingFactory.ruler.grafana.alertingRule;

describe('AlertsFolderView tests', () => {
  it('Should display grafana alert rules when the folder uid matches the name space uid', () => {
    // Arrange
    const folder = mockFolder();
    const folderRules = alertingRuleBuilder.buildList(6);

    // Act
    render(<AlertsFolderView folder={folder} rules={folderRules} />);

    // Assert
    const alertRows = ui.ruleList.row.queryAll();
    expect(alertRows).toHaveLength(6);
    expect(alertRows[0]).toHaveTextContent('Alerting rule 1');
    expect(alertRows[1]).toHaveTextContent('Alerting rule 2');
    expect(alertRows[2]).toHaveTextContent('Alerting rule 3');
    expect(alertRows[3]).toHaveTextContent('Alerting rule 4');
    expect(alertRows[4]).toHaveTextContent('Alerting rule 5');
    expect(alertRows[5]).toHaveTextContent('Alerting rule 6');
  });

  it('Should filter alert rules by the name, case insensitive', async () => {
    // Arrange
    const folder = mockFolder();

    const folderRules = [
      alertingRuleBuilder.build({ grafana_alert: { title: 'CPU Alert' } }),
      alertingRuleBuilder.build({ grafana_alert: { title: 'RAM usage alert' } }),
    ];

    // Act
    const { user } = render(<AlertsFolderView folder={folder} rules={folderRules} />);

    await user.type(ui.filter.name.get(), 'cpu');

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(1);
    expect(ui.ruleList.row.get()).toHaveTextContent('CPU Alert');
  });

  it('Should filter alert rule by labels', async () => {
    // Arrange
    const folder = mockFolder();

    const folderRules = [
      alertingRuleBuilder.build({ grafana_alert: { title: 'CPU Alert' }, labels: {} }),
      alertingRuleBuilder.build({ grafana_alert: { title: 'RAM usage alert' }, labels: { severity: 'critical' } }),
    ];

    // Act
    const { user } = render(<AlertsFolderView folder={folder} rules={folderRules} />);

    await user.type(ui.filter.label.get(), 'severity=critical');

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(1);
    expect(ui.ruleList.row.get()).toHaveTextContent('RAM usage alert');
  });
});
