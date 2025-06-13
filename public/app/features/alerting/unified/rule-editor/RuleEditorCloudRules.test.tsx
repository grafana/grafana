import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { AccessControlAction } from 'app/types';

import { ExpressionEditorProps } from '../components/rule-editor/ExpressionEditor';
import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { GROUP_3, NAMESPACE_2 } from '../mocks/mimirRulerApi';
import { mimirDataSource } from '../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../mocks/server/constants';
import { captureRequests, serializeRequests } from '../mocks/server/events';

jest.mock('../components/rule-editor/ExpressionEditor', () => ({
  // eslint-disable-next-line react/display-name
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

setupMswServer();
mimirDataSource();

describe('RuleEditor cloud', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.DataSourcesRead,
      AccessControlAction.DataSourcesWrite,
      AccessControlAction.DataSourcesCreate,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);
  });

  it('can create a new cloud alert', async () => {
    const { user } = renderRuleEditor();

    const removeExpressionsButtons = await screen.findAllByLabelText(/Remove expression/);
    expect(removeExpressionsButtons).toHaveLength(2);

    // Needs to wait for featrue discovery API call to finish - Check if ruler enabled
    expect(await screen.findByText('Data source-managed')).toBeInTheDocument();

    const switchToCloudButton = screen.getByText('Data source-managed');
    expect(switchToCloudButton).toBeInTheDocument();
    expect(switchToCloudButton).toBeEnabled();

    await user.click(switchToCloudButton);

    //expressions are removed after switching to data-source managed
    expect(screen.queryAllByLabelText(/Remove expression/)).toHaveLength(0);

    expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toBeInTheDocument();

    const dataSourceSelect = await ui.inputs.dataSource.find();
    await user.click(dataSourceSelect);
    await user.click(screen.getByText(MIMIR_DATASOURCE_UID));

    await user.type(await ui.inputs.expr.find(), 'up == 1');

    await user.type(ui.inputs.name.get(), 'my great new rule');
    await clickSelectOption(ui.inputs.namespace.get(), NAMESPACE_2);
    await clickSelectOption(ui.inputs.group.get(), GROUP_3);

    await user.type(ui.inputs.annotationValue(0).get(), 'some summary');
    await user.type(ui.inputs.annotationValue(1).get(), 'some description');

    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await user.click(ui.buttons.addLabel.get());

    // save and check what was sent to backend
    const capture = captureRequests();
    await user.click(ui.buttons.save.get());
    const requests = await capture;

    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});
