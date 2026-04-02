import { render, waitFor } from 'test/test-utils';
import { byLabelText } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { setupPluginsExtensionsHook } from '../../testSetup/plugins';

import RulesFilter from './RulesFilter';

setupMswServer();

jest.mock('../../components/rules/MultipleDataSourcePicker', () => {
  const original = jest.requireActual('../../components/rules/MultipleDataSourcePicker');
  return {
    ...original,
    MultipleDataSourcePicker: () => null,
  };
});

setupPluginsExtensionsHook();

const ui = {
  searchInput: byLabelText('Search'),
};

beforeEach(() => {
  locationService.replace({ search: '' });
});

describe('RulesFilter', () => {
  it('Should render the search input', async () => {
    render(<RulesFilter />);

    await waitFor(() => {
      expect(ui.searchInput.get()).toBeInTheDocument();
    });
  });
});
