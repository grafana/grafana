import { screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byText } from 'testing-library-selector';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AccessControlAction } from 'app/types';

import { RecordingRuleEditorProps } from '../components/rule-editor/RecordingRuleEditor';
import { grantUserPermissions } from '../mocks';
import { GROUP_3, NAMESPACE_2 } from '../mocks/mimirRulerApi';
import { mimirDataSource } from '../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../mocks/server/constants';
import { captureRequests, serializeRequests } from '../mocks/server/events';

jest.mock('../components/rule-editor/RecordingRuleEditor', () => ({
  RecordingRuleEditor: ({ queries, onChangeQuery }: Pick<RecordingRuleEditorProps, 'queries' | 'onChangeQuery'>) => {
    const onChange = (expr: string) => {
      const query = queries[0];

      const merged = {
        ...query,
        expr,
        model: {
          ...query.model,
          expr,
        },
      };

      onChangeQuery([merged]);
    };

    return <input data-testid="expr" onChange={(e) => onChange(e.target.value)} />;
  },
}));

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.mock('app/features/query/components/QueryEditorRow', () => ({
  // eslint-disable-next-line react/display-name
  QueryEditorRow: () => <p>hi</p>,
}));

setupMswServer();
mimirDataSource();

describe('RuleEditor recording rules', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.DataSourcesRead,
      AccessControlAction.DataSourcesWrite,
      AccessControlAction.DataSourcesCreate,
      AccessControlAction.FoldersWrite,
      AccessControlAction.FoldersRead,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);
  });

  it('can create a new cloud recording rule', async () => {
    renderRuleEditor(undefined, 'recording');

    await waitForElementToBeRemoved(screen.queryAllByTestId('Spinner'));
    await userEvent.type(await ui.inputs.name.find(), 'my great new recording rule');

    const dataSourceSelect = ui.inputs.dataSource.get();
    await userEvent.click(dataSourceSelect);

    await userEvent.click(screen.getByText(MIMIR_DATASOURCE_UID));
    await clickSelectOption(ui.inputs.namespace.get(), NAMESPACE_2);
    await clickSelectOption(ui.inputs.group.get(), GROUP_3);

    await userEvent.type(await ui.inputs.expr.find(), 'up == 1');

    // try to save, find out that recording rule name is invalid
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() =>
      expect(
        byText(
          'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.'
        ).get()
      ).toBeInTheDocument()
    );

    // fix name and re-submit
    await userEvent.clear(await ui.inputs.name.find());
    await userEvent.type(await ui.inputs.name.find(), 'my:great:new:recording:rule');

    // save and check what was sent to backend
    const capture = captureRequests();
    await userEvent.click(ui.buttons.save.get());
    const requests = await capture;

    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});
