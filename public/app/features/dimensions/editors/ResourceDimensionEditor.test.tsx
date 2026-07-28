import { render, screen } from 'test/test-utils';

import { type ResourceDimensionConfig, ResourceDimensionMode } from '@grafana/schema';

import { MediaType, ResourceFolderName } from '../types';

import { ResourceDimensionEditor } from './ResourceDimensionEditor';

function makeProps(value: ResourceDimensionConfig, onChange = jest.fn()) {
  return {
    props: {
      value,
      onChange,
      context: { data: [] },
      item: { settings: { resourceType: MediaType.Icon, folderName: ResourceFolderName.Icon } },
      id: 'resource',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    onChange,
  };
}

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

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: ResourceDimensionMode.Field }));
  });

  it('renders the field picker in Field mode', () => {
    const { props } = makeProps({ mode: ResourceDimensionMode.Field, fixed: '', field: '' });
    render(<ResourceDimensionEditor {...props} />);

    expect(screen.getByRole('radio', { name: 'Field' })).toBeChecked();
    expect(screen.queryByPlaceholderText('Select a value')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
