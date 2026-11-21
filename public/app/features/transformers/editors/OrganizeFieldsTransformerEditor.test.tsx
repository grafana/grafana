import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldType, toDataFrame } from '@grafana/data';
import { type OrganizeFieldsTransformerOptions } from '@grafana/data/internal';

import { OrganizeFieldsTransformerEditor } from './OrganizeFieldsTransformerEditor';

const input = [
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1] },
      { name: 'host', type: FieldType.string, values: ['web-1'], config: { displayName: 'Host name' } },
      { name: 'region', type: FieldType.string, values: ['us'] },
    ],
  }),
];

const promoted: OrganizeFieldsTransformerOptions = {
  excludeByName: { host: true },
  indexByName: { region: 0, time: 1, host: 2 },
  renameByName: {},
  referenceByName: { host: { name: 'host' }, region: { name: 'region' }, time: { name: 'time' } },
};

const visibilityToggle = (fieldName: string) =>
  within(screen.getByText(fieldName, { selector: 'p' }).parentElement!).getByRole('button', {
    name: /^(Enable|Disable)$/,
  });

describe('OrganizeFieldsTransformerEditor', () => {
  it('shows fields by reference under the names they have now', () => {
    render(<OrganizeFieldsTransformerEditor input={input} options={promoted} onChange={jest.fn()} />);

    expect(screen.getAllByText(/^(time|Host name|region)$/, { selector: 'p' }).map((name) => name.textContent)).toEqual(
      ['region', 'time', 'Host name']
    );
    expect(visibilityToggle('Host name')).toHaveAccessibleName('Enable');
    expect(visibilityToggle('region')).toHaveAccessibleName('Disable');
  });

  it('changes the referenced entry when a field is shown again', async () => {
    const onChange = jest.fn();
    render(<OrganizeFieldsTransformerEditor input={input} options={promoted} onChange={onChange} />);

    await userEvent.click(visibilityToggle('Host name'));

    expect(onChange).toHaveBeenCalledWith({
      excludeByName: { 'Host name': false },
      indexByName: { region: 0, time: 1, 'Host name': 2 },
      renameByName: {},
      referenceByName: { 'Host name': { name: 'host' }, region: { name: 'region' }, time: { name: 'time' } },
    });
  });

  it('keeps options without references as they are', async () => {
    const onChange = jest.fn();
    const options = { excludeByName: { region: true }, indexByName: {}, renameByName: {} };
    render(<OrganizeFieldsTransformerEditor input={input} options={options} onChange={onChange} />);

    await userEvent.click(visibilityToggle('Host name'));

    expect(onChange).toHaveBeenCalledWith({ ...options, excludeByName: { region: true, 'Host name': true } });
  });

  it('keeps a field hidden by name when a referenced field takes its name', async () => {
    const onChange = jest.fn();
    const swapped = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1] },
          { name: 'host', type: FieldType.string, values: ['web-1'], config: { displayName: 'region' } },
          { name: 'region', type: FieldType.string, values: ['us'], config: { displayName: 'Region (old)' } },
        ],
      }),
    ];
    const options = {
      excludeByName: { host: false, region: true },
      indexByName: {},
      renameByName: {},
      referenceByName: { host: { name: 'host' } },
    };
    render(<OrganizeFieldsTransformerEditor input={swapped} options={options} onChange={onChange} />);

    await userEvent.click(visibilityToggle('time'));

    expect(onChange).toHaveBeenCalledWith({ ...options, excludeByName: { host: false, region: true, time: true } });
  });

  it('shows keys with malformed references by name', () => {
    const options = {
      excludeByName: { region: true },
      indexByName: {},
      renameByName: {},
      referenceByName: { region: null },
    } as unknown as OrganizeFieldsTransformerOptions;
    render(<OrganizeFieldsTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    expect(visibilityToggle('region')).toHaveAccessibleName('Enable');
    expect(visibilityToggle('Host name')).toHaveAccessibleName('Disable');
  });
});
