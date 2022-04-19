import React, { FC } from 'react';
import { useObservable } from 'react-use';
import { Subject } from 'rxjs';
import { Field, InlineField, InlineFieldRow, Select, VerticalGroup } from '@grafana/ui';
import { SelectableValue, StandardEditorProps } from '@grafana/data';

import { PanelOptions } from '../models.gen';
import { CanvasEditorOptions } from './elementEditor';
import { HorizontalConstraint, Placement, VerticalConstraint } from 'app/features/canvas';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';

const places: Array<keyof Placement> = ['top', 'left', 'bottom', 'right', 'width', 'height'];

const horizontalOptions: Array<SelectableValue<HorizontalConstraint>> = [
  { label: 'Left', value: HorizontalConstraint.Left },
  { label: 'Right', value: HorizontalConstraint.Right },
];

const verticalOptions: Array<SelectableValue<VerticalConstraint>> = [
  { label: 'Top', value: VerticalConstraint.Top },
  { label: 'Bottom', value: VerticalConstraint.Bottom },
];

export const PlacementEditor: FC<StandardEditorProps<any, CanvasEditorOptions, PanelOptions>> = ({
  item,
  onChange,
}) => {
  const settings = item.settings;

  // Will force a rerender whenever the subject changes
  useObservable(settings?.scene ? settings.scene.moved : new Subject());

  if (!settings) {
    return <div>Loading...</div>;
  }

  const element = settings.element;
  if (!element) {
    return <div>???</div>;
  }
  const { options } = element;
  const { placement, constraint: layout } = options;

  // const onToggleAnchor = (element: ElementState, anchor: keyof Anchor) => {
  //   settings.scene.toggleAnchor(element, anchor);
  // };

  const onHorizontalConstraintChange = (h: SelectableValue<HorizontalConstraint>) => {
    element.options.constraint!.horizontal = h.value;
    element.validatePlacement();
    settings.scene.revId++;
    settings.scene.save();
    setTimeout(() => settings.scene.initMoveable(true), 100);
  };

  const onVerticalConstraintChange = (v: SelectableValue<VerticalConstraint>) => {
    element.options.constraint!.vertical = v.value;
    element.validatePlacement();
    settings.scene.revId++;
    settings.scene.save();
    setTimeout(() => settings.scene.initMoveable(true), 100);
  };

  return (
    <div>
      <VerticalGroup>
        <Select options={verticalOptions} onChange={onVerticalConstraintChange} value={layout?.vertical} />
        <Select
          options={horizontalOptions}
          onChange={onHorizontalConstraintChange}
          value={options.constraint?.horizontal}
        />
      </VerticalGroup>
      <br />

      <Field label="Position">
        <>
          {places.map((p) => {
            const v = placement![p];
            if (v == null) {
              return null;
            }
            return (
              <InlineFieldRow key={p}>
                <InlineField label={p} labelWidth={8} grow={true}>
                  <NumberInput value={v} onChange={(v) => console.log('TODO, edit!!!', p, v)} />
                </InlineField>
              </InlineFieldRow>
            );
          })}
        </>
      </Field>
    </div>
  );
};
