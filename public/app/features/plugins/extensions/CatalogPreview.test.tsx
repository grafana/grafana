import { render, screen } from '@testing-library/react';

import { type ComponentDescriptor } from '@grafana/data';

import { CatalogReply } from './adapters/assistant/CatalogReply';
import * as descriptors from './useComponentDescriptors';
import * as components from './usePluginComponent';

it('should ask for inputs without loading the component after the reply settles', () => {
  const entry: ComponentDescriptor = {
    id: 'example-app/preview/v1',
    pluginId: 'example-app',
    title: 'Preview',
    version: 'v1',
    datasource: 'example-source',
    prompt: 'Show data',
  };
  const descriptor = jest.spyOn(descriptors, 'useComponentDescriptor').mockReturnValue({
    entry,
    loading: false,
    retry: jest.fn(),
  });
  const load = jest.spyOn(components, 'useCatalogComponent');
  try {
    const { rerender } = render(
      <CatalogReply componentId="example-app/preview/v1" reply={{ turn: { isStreaming: true } }} />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the reply to finish');
    expect(descriptor).not.toHaveBeenCalled();

    rerender(<CatalogReply componentId="example-app/preview/v1" reply={{ turn: { isStreaming: false } }} />);
    expect(screen.getByRole('button', { name: 'Show preview' })).toBeDisabled();
    expect(load).not.toHaveBeenCalled();
  } finally {
    descriptor.mockRestore();
    load.mockRestore();
  }
});
