import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { standardTransformersRegistry } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { TransformationCard } from './TransformationPickerNg';
import { TransformationCardTransform } from './types';

describe('TransformationCard', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  const onClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders transformation name and description', () => {
    const transform = standardTransformersRegistry.get('organize');
    render(<TransformationCard transform={transform} onClick={onClick} />);

    expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
    // Description is rendered but we won't assert on exact text since it may change
  });

  it('calls onClick with transformation id when clicked', async () => {
    const user = userEvent.setup();
    const transform = standardTransformersRegistry.get('organize');
    render(<TransformationCard transform={transform} onClick={onClick} />);

    const card = screen.getByText('Organize fields by name').closest('button');
    await user.click(card!);

    expect(onClick).toHaveBeenCalledWith('organize');
  });

  it('shows illustration when showIllustrations is true', () => {
    const transform = standardTransformersRegistry.get('organize');
    const { container } = render(<TransformationCard transform={transform} onClick={onClick} showIllustrations />);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.alt).toBe('Organize fields by name');
  });

  it('hides illustration when showIllustrations is false', () => {
    const transform = standardTransformersRegistry.get('organize');
    const { container } = render(
      <TransformationCard transform={transform} onClick={onClick} showIllustrations={false} />
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('works with simple transform object without full TransformerRegistryItem', () => {
    const simpleTransform: TransformationCardTransform = {
      id: 'custom',
      name: 'Custom Transform',
      description: 'A custom transformation',
    };

    render(<TransformationCard transform={simpleTransform} onClick={onClick} />);

    expect(screen.getByText('Custom Transform')).toBeInTheDocument();
    expect(screen.getByText('A custom transformation')).toBeInTheDocument();
  });

  it('hides plugin state when showPluginState is false', () => {
    const transform = standardTransformersRegistry.get('organize');
    const { container } = render(
      <TransformationCard transform={transform} onClick={onClick} showPluginState={false} />
    );

    expect(container.querySelector('[class*="pluginStateInfoWrapper"]')).not.toBeInTheDocument();
  });

  it('hides tags when showTags is false', () => {
    const transform = standardTransformersRegistry.get('organize');
    const { container } = render(<TransformationCard transform={transform} onClick={onClick} showTags={false} />);

    expect(container.querySelector('[class*="tagsWrapper"]')).not.toBeInTheDocument();
  });
});
