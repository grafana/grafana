import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { standardTransformersRegistry } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { SqlExpressionCard } from './SqlExpressionCard';
import { TransformationCard } from './TransformationCard';

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

describe('SqlExpressionCard', () => {
  const onClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders SQL expression name and description', () => {
    render(<SqlExpressionCard name="Transform with SQL" description="Manipulate data with SQL" onClick={onClick} />);

    expect(screen.getByText('Transform with SQL')).toBeInTheDocument();
    expect(screen.getByText('Manipulate data with SQL')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    render(<SqlExpressionCard name="Transform with SQL" description="Test" onClick={onClick} />);

    const card = screen.getByText('Transform with SQL').closest('button');
    await user.click(card!);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders image when imageUrl is provided', () => {
    const { container } = render(
      <SqlExpressionCard name="SQL" description="Test" imageUrl="/test.svg" onClick={onClick} />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.src).toContain('/test.svg');
  });
});
