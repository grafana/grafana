import { render, screen } from 'test/test-utils';

import { type ResourceDimensionConfig, ResourceDimensionMode } from '@grafana/schema';

import { MediaType, ResourceFolderName, type ResourceDimensionOptions } from '../types';

import { ResourceDimensionEditor } from './ResourceDimensionEditor';
import { makePropsFactory } from './test-utils';

const makeProps = makePropsFactory<ResourceDimensionConfig, ResourceDimensionOptions>('resource', {
  resourceType: MediaType.Icon,
  folderName: ResourceFolderName.Icon,
});

describe('ResourceDimensionEditor', () => {
  it('shows the resource picker in Fixed mode', () => {
    const { props } = makeProps({ mode: ResourceDimensionMode.Fixed, fixed: '', field: '' });
    render(<ResourceDimensionEditor {...props} />);

    expect(screen.getByRole('radio', { name: 'Fixed' })).toBeChecked();
    expect(screen.getByPlaceholderText('Select a value')).toBeInTheDocument();
  });

  it('switches the source to Field via the radio group', async () => {
    const { props, onChange } = makeProps({ mode: ResourceDimensionMode.Fixed, fixed: '', field: '' });
    const { user } = render(<ResourceDimensionEditor {...props} />);

    await user.click(screen.getByRole('radio', { name: 'Field' }));

    // Only the mode flips; fixed/field are preserved on the emitted config.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ mode: ResourceDimensionMode.Field, fixed: '', field: '' });
  });

  it('renders the field picker in Field mode', () => {
    const { props } = makeProps({ mode: ResourceDimensionMode.Field, fixed: '', field: '' });
    render(<ResourceDimensionEditor {...props} />);

    expect(screen.getByRole('radio', { name: 'Field' })).toBeChecked();
    expect(screen.queryByPlaceholderText('Select a value')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
