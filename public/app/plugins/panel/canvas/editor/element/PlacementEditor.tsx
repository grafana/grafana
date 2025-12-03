import { useObservable } from 'react-use';
import { Subject } from 'rxjs';

import { SelectableValue, StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { PositionDimensionConfig, ScalarDimensionConfig, ScalarDimensionMode } from '@grafana/schema';
import { Field, Icon, InlineField, InlineFieldRow, Select, Stack } from '@grafana/ui';
import { PositionDimensionEditor } from 'app/features/dimensions/editors/PositionDimensionEditor';
import { ScalarDimensionEditor } from 'app/features/dimensions/editors/ScalarDimensionEditor';

import { HorizontalConstraint, Options, Placement, VerticalConstraint } from '../../panelcfg.gen';

import { ConstraintSelectionBox } from './ConstraintSelectionBox';
import { QuickPositioning } from './QuickPositioning';
import { CanvasEditorOptions } from './elementEditor';

const places: Array<keyof Placement> = ['top', 'left', 'bottom', 'right', 'width', 'height'];

type Props = StandardEditorProps<unknown, CanvasEditorOptions, Options>;

export function PlacementEditor({ item }: Props) {
  const settings = item.settings;
  const horizontalOptions: Array<SelectableValue<HorizontalConstraint>> = [
    { label: t('canvas.placement-editor.horizontal-options.label-left', 'Left'), value: HorizontalConstraint.Left },
    { label: t('canvas.placement-editor.horizontal-options.label-right', 'Right'), value: HorizontalConstraint.Right },
    {
      label: t('canvas.placement-editor.horizontal-options.label-left-and-right', 'Left & right'),
      value: HorizontalConstraint.LeftRight,
    },
    {
      label: t('canvas.placement-editor.horizontal-options.label-center', 'Center'),
      value: HorizontalConstraint.Center,
    },
    { label: t('canvas.placement-editor.horizontal-options.label-scale', 'Scale'), value: HorizontalConstraint.Scale },
  ];

  const verticalOptions: Array<SelectableValue<VerticalConstraint>> = [
    { label: t('canvas.placement-editor.vertical-options.label-top', 'Top'), value: VerticalConstraint.Top },
    { label: t('canvas.placement-editor.vertical-options.label-bottom', 'Bottom'), value: VerticalConstraint.Bottom },
    {
      label: t('canvas.placement-editor.vertical-options.label-top-and-bottom', 'Top & bottom'),
      value: VerticalConstraint.TopBottom,
    },
    { label: t('canvas.placement-editor.vertical-options.label-center', 'Center'), value: VerticalConstraint.Center },
    { label: t('canvas.placement-editor.vertical-options.label-scale', 'Scale'), value: VerticalConstraint.Scale },
  ];

  // Will force a rerender whenever the subject changes
  useObservable(settings?.scene ? settings.scene.moved : new Subject());

  if (!settings) {
    return (
      <div>
        <Trans i18nKey="canvas.placement-editor.loading">Loading...</Trans>
      </div>
    );
  }

  const element = settings.element;
  if (!element) {
    return <div>???</div>;
  }
  const { options } = element;
  const { placement, constraint: layout } = options;

  // Initialize rotation if not set
  if (placement && !placement.rotation) {
    placement.rotation = { fixed: 0, min: 0, max: 360, mode: ScalarDimensionMode.Clamped };
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
    element.setPlacementFromConstraint(undefined, undefined, settings.scene.scale);
    settings.scene.revId++;
    settings.scene.save(true);
    reselectElementAfterChange();
  };

  const onVerticalConstraintSelect = (v: SelectableValue<VerticalConstraint>) => {
    onVerticalConstraintChange(v.value!);
  };

  const onVerticalConstraintChange = (v: VerticalConstraint) => {
    element.options.constraint!.vertical = v;
    element.setPlacementFromConstraint(undefined, undefined, settings.scene.scale);
    settings.scene.revId++;
    settings.scene.save(true);
    reselectElementAfterChange();
  };

  const onPositionChange = (value: PositionDimensionConfig | undefined, key: keyof Placement) => {
    if (value && key !== 'rotation') {
      element.options.placement![key] = value as any;
      element.updateData(settings.scene.context);
      element.applyLayoutStylesToDiv();
      settings.scene.clearCurrentSelection(true);
      reselectElementAfterChange();
    }
  };

  const onRotationChange = (value?: ScalarDimensionConfig) => {
    if (value) {
      element.options.placement!.rotation = value;
      element.updateData(settings.scene.context);
      element.applyLayoutStylesToDiv();
      settings.scene.clearCurrentSelection(true);
      reselectElementAfterChange();
    }
  };

  const constraint = element.tempConstraint ?? layout ?? {};
  const editorContext = { ...settings.scene.context, data: settings.scene.context.getPanelData()?.series ?? [] };

  return (
    <div>
      <QuickPositioning onPositionChange={onPositionChange} settings={settings} element={element} />
      <br />
      <Field label={t('canvas.placement-editor.label-constraints', 'Constraints')} noMargin>
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

      <Field label={t('canvas.placement-editor.label-position', 'Position')} noMargin>
        <>
          {places.map((p) => {
            const v = placement![p];
            if (v == null) {
              return null;
            }

            return (
              <InlineFieldRow key={p}>
                <InlineField label={p} labelWidth={8} grow={true}>
                  <PositionDimensionEditor
                    value={v as PositionDimensionConfig}
                    context={editorContext}
                    onChange={(val) => onPositionChange(val, p)}
                    item={{} as any}
                  />
                </InlineField>
              </InlineFieldRow>
            );
          })}
          {placement?.rotation && (
            <InlineFieldRow>
              <InlineField label={t('canvas.placement-editor.label-rotation', 'rotation')} labelWidth={8} grow={true}>
                <ScalarDimensionEditor
                  value={placement.rotation}
                  context={editorContext}
                  onChange={onRotationChange}
                  item={
                    {
                      id: 'rotation',
                      name: 'Rotation',
                      settings: {
                        min: 0,
                        max: 360,
                      },
                    } as StandardEditorsRegistryItem<ScalarDimensionConfig>
                  }
                />
              </InlineField>
            </InlineFieldRow>
          )}
        </>
      </Field>
    </div>
  );
}
