import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { FieldConfigOptionsRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { OverrideEditor } from './OverrideEditor';

describe('OverrideEditor', () => {
  let registry: FieldConfigOptionsRegistry;

  beforeEach(() => {
    registry = new FieldConfigOptionsRegistry(() => {
      return [
        {
          id: 'lineColor',
          name: 'Line color',
          path: 'lineColor',
          isCustom: true,
          shouldApply: () => true,
          process: () => null,
          override: () => null,
          editor: () => null,
        },
        {
          id: 'lineWidth',
          name: 'Line width',
          path: 'lineWidth',
          isCustom: true,
          shouldApply: () => true,
          process: () => null,
          override: () => null,
          editor: () => null,
        },
      ];
    });
  });

  it('allow override option selection', () => {
    const { queryAllByLabelText, getByLabelText } = render(
      <OverrideEditor
        name={'test'}
        data={[]}
        override={{
          matcher: {
            id: 'byName',
            options: 'A-series',
          },
          properties: [],
        }}
        registry={registry}
        onChange={() => {}}
        onRemove={() => {}}
      />
    );

    fireEvent.click(getByLabelText(selectors.components.ValuePicker.button));
    const selectOptions = queryAllByLabelText(selectors.components.Select.option);

    expect(selectOptions).toHaveLength(2);
  });

  it('should be able to handle non registered properties without throwing exceptions', () => {
    registry.register({
      id: 'lineStyle',
      name: 'Line style',
      path: 'lineStyle',
      isCustom: true,
      shouldApply: () => true,
      process: () => null,
      override: () => null,
      editor: () => null,
      hideFromOverrides: true,
    });

    render(
      <OverrideEditor
        name={'test'}
        data={[]}
        override={{
          matcher: {
            id: 'byName',
            options: 'A-series',
          },
          properties: [
            {
              id: 'lineStyle',
              value: 'customValue',
            },
            {
              id: 'does.not.exist',
              value: 'testing',
            },
          ],
        }}
        registry={registry}
        onChange={() => {}}
        onRemove={() => {}}
      />
    );
  });

  it('should not allow override selection that marked as hidden from overrides', () => {
    registry.register({
      id: 'lineStyle',
      name: 'Line style',
      path: 'lineStyle',
      isCustom: true,
      shouldApply: () => true,
      process: () => null,
      override: () => null,
      editor: () => null,
      hideFromOverrides: true,
    });

    const { queryAllByLabelText, getByLabelText } = render(
      <OverrideEditor
        name={'test'}
        data={[]}
        override={{
          matcher: {
            id: 'byName',
            options: 'A-series',
          },
          properties: [],
        }}
        registry={registry}
        onChange={() => {}}
        onRemove={() => {}}
      />
    );

    fireEvent.click(getByLabelText(selectors.components.ValuePicker.button));
    const selectOptions = queryAllByLabelText(selectors.components.Select.option);

    expect(selectOptions).toHaveLength(2);
  });
});
