import React, { FC } from 'react';
import { useObservable } from 'react-use';
import { Subject } from 'rxjs';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { Field, InlineField, InlineFieldRow, RadioButtonGroup, Select, VerticalGroup } from '@grafana/ui';
import { HorizontalConstraint, Placement, QuickPlacement, VerticalConstraint } from 'app/features/canvas';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';

import { PanelOptions } from '../models.gen';

import { CanvasEditorOptions } from './elementEditor';

const places: Array<keyof Placement> = ['top', 'left', 'bottom', 'right', 'width', 'height'];

const horizontalOptions: Array<SelectableValue<HorizontalConstraint>> = [
  { label: 'Left', value: HorizontalConstraint.Left },
  { label: 'Right', value: HorizontalConstraint.Right },
  { label: 'Left and right', value: HorizontalConstraint.LeftRight },
  { label: 'Center', value: HorizontalConstraint.Center },
  { label: 'Scale', value: HorizontalConstraint.Scale },
];

const verticalOptions: Array<SelectableValue<VerticalConstraint>> = [
  { label: 'Top', value: VerticalConstraint.Top },
  { label: 'Bottom', value: VerticalConstraint.Bottom },
  { label: 'Top and bottom', value: VerticalConstraint.TopBottom },
  { label: 'Center', value: VerticalConstraint.Center },
  { label: 'Scale', value: VerticalConstraint.Scale },
];

const alignmentOptions: Array<SelectableValue<QuickPlacement>> = [
  { label: 'Align left', value: QuickPlacement.Left },
  { label: 'Align h centers', value: QuickPlacement.HorizontalCenter },
  { label: 'Align right', value: QuickPlacement.Right },
  { label: 'Align top', value: QuickPlacement.Top },
  { label: 'Align v centers', value: QuickPlacement.VerticalCenter },
  { label: 'Align bottom', value: QuickPlacement.Bottom },
];

export const PlacementEditor: FC<StandardEditorProps<any, CanvasEditorOptions, PanelOptions>> = ({ item }) => {
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

  const onHorizontalConstraintChange = (h: SelectableValue<HorizontalConstraint>) => {
    element.options.constraint!.horizontal = h.value;
    element.setPlacementFromConstraint();
    settings.scene.revId++;
    settings.scene.save(true);
  };

  const onVerticalConstraintChange = (v: SelectableValue<VerticalConstraint>) => {
    element.options.constraint!.vertical = v.value;
    element.setPlacementFromConstraint();
    settings.scene.revId++;
    settings.scene.save(true);
  };

  const onPositionChange = (value: number | undefined, placement: keyof Placement) => {
    element.options.placement![placement] = value ?? element.options.placement![placement];
    element.applyLayoutStylesToDiv();
    settings.scene.clearCurrentSelection();
  };

  const onQuickPositioningChange = (position: string) => {
    switch (position) {
      case QuickPlacement.Top:
        onPositionChange(0, 'top');
        break;
      case QuickPlacement.Bottom:
        onPositionChange(getRightBottomPosition(element.options.placement?.height ?? 0, 'bottom'), 'top');
        break;
      case QuickPlacement.VerticalCenter:
        onPositionChange(getCenterPosition(element.options.placement?.height ?? 0, 'v'), 'top');
        break;
      case QuickPlacement.Left:
        onPositionChange(0, 'left');
        break;
      case QuickPlacement.Right:
        onPositionChange(getRightBottomPosition(element.options.placement?.width ?? 0, 'right'), 'left');
        break;
      case QuickPlacement.HorizontalCenter:
        onPositionChange(getCenterPosition(element.options.placement?.width ?? 0, 'h'), 'left');
        break;
    }
  };

  const getCenterPosition = (elementSize: number, align: 'h' | 'v') => {
    const sceneSize = align === 'h' ? settings.scene.width : settings.scene.height;

    return (sceneSize - elementSize) / 2;
  };

  const getRightBottomPosition = (elementSize: number, align: 'right' | 'bottom') => {
    const sceneSize = align === 'right' ? settings.scene.width : settings.scene.height;

    return sceneSize - elementSize;
  };

  return (
    <div>
      <RadioButtonGroup options={alignmentOptions} onChange={(v) => onQuickPositioningChange(v)} />
      <br />
      <br />

      <Field label="Constraints">
        <VerticalGroup>
          <Select options={verticalOptions} onChange={onVerticalConstraintChange} value={layout?.vertical} />
          <Select
            options={horizontalOptions}
            onChange={onHorizontalConstraintChange}
            value={options.constraint?.horizontal}
          />
        </VerticalGroup>
      </Field>
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
                  <NumberInput value={v} onChange={(v) => onPositionChange(v, p)} />
                </InlineField>
              </InlineFieldRow>
            );
          })}
        </>
      </Field>
    </div>
  );
};
