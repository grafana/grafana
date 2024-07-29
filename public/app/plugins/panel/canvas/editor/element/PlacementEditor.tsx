import { useObservable } from 'react-use';
import { Subject } from 'rxjs';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { Field, Icon, InlineField, InlineFieldRow, Select, Stack } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { HorizontalConstraint, Options, Placement, VerticalConstraint } from '../../panelcfg.gen';

import { ConstraintSelectionBox } from './ConstraintSelectionBox';
import { QuickPositioning } from './QuickPositioning';
import { CanvasEditorOptions } from './elementEditor';

const places: Array<keyof Placement> = ['top', 'left', 'bottom', 'right', 'width', 'height', 'rotation'];

const horizontalOptions: Array<SelectableValue<HorizontalConstraint>> = [
  { label: 'Left', value: HorizontalConstraint.Left },
  { label: 'Right', value: HorizontalConstraint.Right },
  { label: 'Left & right', value: HorizontalConstraint.LeftRight },
  { label: 'Center', value: HorizontalConstraint.Center },
  { label: 'Scale', value: HorizontalConstraint.Scale },
];

const verticalOptions: Array<SelectableValue<VerticalConstraint>> = [
  { label: 'Top', value: VerticalConstraint.Top },
  { label: 'Bottom', value: VerticalConstraint.Bottom },
  { label: 'Top & bottom', value: VerticalConstraint.TopBottom },
  { label: 'Center', value: VerticalConstraint.Center },
  { label: 'Scale', value: VerticalConstraint.Scale },
];

type Props = StandardEditorProps<unknown, CanvasEditorOptions, Options>;

export function PlacementEditor({ item }: Props) {
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

  if (placement) {
    placement.rotation = placement?.rotation ?? 0;
  }

  const reselectElementAfterChange = () => {
    setTimeout(() => {
      settings.scene.select({ targets: [element.div!] });
    });
  };

  const onHorizontalConstraintSelect = (h: SelectableValue<HorizontalConstraint>) => {
    onHorizontalConstraintChange(h.value!);
  };

  const onHorizontalConstraintChange = (h: HorizontalConstraint) => {
    element.options.constraint!.horizontal = h;
    element.setPlacementFromConstraint();
    settings.scene.revId++;
    settings.scene.save(true);
    reselectElementAfterChange();
  };

  const onVerticalConstraintSelect = (v: SelectableValue<VerticalConstraint>) => {
    onVerticalConstraintChange(v.value!);
  };

  const onVerticalConstraintChange = (v: VerticalConstraint) => {
    element.options.constraint!.vertical = v;
    element.setPlacementFromConstraint();
    settings.scene.revId++;
    settings.scene.save(true);
    reselectElementAfterChange();
  };

  const onPositionChange = (value: number | undefined, placement: keyof Placement) => {
    element.options.placement![placement] = value ?? element.options.placement![placement];
    element.applyLayoutStylesToDiv();
    settings.scene.clearCurrentSelection(true);
    reselectElementAfterChange();
  };

  const constraint = element.tempConstraint ?? layout ?? {};

  return (
    <div>
      <QuickPositioning onPositionChange={onPositionChange} settings={settings} element={element} />
      <br />
      <Field label="Constraints">
        <Stack direction="row">
          <ConstraintSelectionBox
            onVerticalConstraintChange={onVerticalConstraintChange}
            onHorizontalConstraintChange={onHorizontalConstraintChange}
            currentConstraints={constraint}
          />
          <Stack direction="column">
            <Stack direction="row">
              <Icon name="arrows-h" />
              <Select
                options={horizontalOptions}
                onChange={onHorizontalConstraintSelect}
                value={constraint.horizontal}
              />
            </Stack>
            <Stack direction="row">
              <Icon name="arrows-v" />
              <Select options={verticalOptions} onChange={onVerticalConstraintSelect} value={constraint.vertical} />
            </Stack>
          </Stack>
        </Stack>
      </Field>

      <br />

      <Field label="Position">
        <>
          {places.map((p) => {
            const v = placement![p];
            if (v == null) {
              return null;
            }

            // Need to set explicit min/max for rotation as logic only can handle 0-360
            const min = p === 'rotation' ? 0 : undefined;
            const max = p === 'rotation' ? 360 : undefined;

            return (
              <InlineFieldRow key={p}>
                <InlineField label={p} labelWidth={8} grow={true}>
                  <NumberInput min={min} max={max} value={v} onChange={(v) => onPositionChange(v, p)} />
                </InlineField>
              </InlineFieldRow>
            );
          })}
        </>
      </Field>
    </div>
  );
}
