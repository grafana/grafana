import { render, screen } from 'test/test-utils';

import { PluginExtensionTypes } from '@grafana/data';

import { ToolbarExtensionPointMenu } from './ToolbarExtensionPointMenu';

describe('ToolbarExtensionPointMenu', () => {
  it('shows the full notebook title in the menu option', () => {
    const title = 'Add to "A long notebook title for investigating failures"';

    render(
      <ToolbarExtensionPointMenu
        extensions={[
          {
            id: 'notebook-quick-add',
            pluginId: 'grafana',
            type: PluginExtensionTypes.link,
            title,
            description: 'Add to the recent notebook',
            onClick: jest.fn(),
          },
        ]}
        onSelect={jest.fn()}
      />
    );

    const item = screen.getByRole('menuitem', { name: title });
    expect(item).toHaveTextContent(title);
  });
});
