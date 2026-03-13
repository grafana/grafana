import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ClusteringSwitchEditor,
  DEFAULT_CLUSTERING_ANNOTATION_SPACING,
  DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED,
} from './ClusteringSwitchEditor';

describe('ClusteringSwitchEditor', () => {
  it('should render a switch', () => {
    render(
      <ClusteringSwitchEditor
        value={DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED}
        onChange={() => {}}
        item={{} as never}
        context={{} as never}
      />
    );
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
  it('should display switch as unchecked when value is DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED', () => {
    render(
      <ClusteringSwitchEditor
        value={DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED}
        onChange={() => {}}
        item={{} as never}
        context={{} as never}
      />
    );
    expect(screen.getByRole('switch')).not.toBeChecked();
  });
  it('should display switch as checked when value is greater than 0', () => {
    render(
      <ClusteringSwitchEditor
        value={DEFAULT_CLUSTERING_ANNOTATION_SPACING}
        onChange={() => {}}
        item={{} as never}
        context={{} as never}
      />
    );
    expect(screen.getByRole('switch')).toBeChecked();
  });
  it('should display switch as checked when value is 0', () => {
    render(<ClusteringSwitchEditor value={0} onChange={() => {}} item={{} as never} context={{} as never} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });
  it('should display switch as checked when value is 1', () => {
    render(<ClusteringSwitchEditor value={1} onChange={() => {}} item={{} as never} context={{} as never} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });
  it('should call onChange when toggling from off to on', async () => {
    const onChange = jest.fn();
    render(
      <ClusteringSwitchEditor
        value={DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED}
        onChange={onChange}
        item={{} as never}
        context={{} as never}
      />
    );
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(DEFAULT_CLUSTERING_ANNOTATION_SPACING);
  });
  it('should call onChange when toggling from on to off', async () => {
    const onChange = jest.fn();
    render(
      <ClusteringSwitchEditor
        value={DEFAULT_CLUSTERING_ANNOTATION_SPACING}
        onChange={onChange}
        item={{} as never}
        context={{} as never}
      />
    );
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(DEFAULT_CLUSTERING_ANNOTATION_SPACING_DISABLED);
  });
});
