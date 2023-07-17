import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { reportInteraction } from '@grafana/runtime';

import { AngularPanelPluginWarning } from './AngularPanelPluginWarning';

jest.mock('@grafana/runtime', () => ({
  reportInteraction: jest.fn(),
}));

describe('AngularPanelPluginWarning', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('reports interaction when clicking on the link', async () => {
    const pluginId = 'test';
    render(<AngularPanelPluginWarning plugin={getPanelPlugin({ id: pluginId })} />);
    const link = screen.getByText('Read more on Angular deprecation');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);
    expect(reportInteraction).toHaveBeenCalledWith('angular_deprecation_docs_clicked', {
      pluginId,
    });
  });
});
