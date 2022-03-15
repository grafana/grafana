import React, { FC } from 'react';
import { Button, Field, HorizontalGroup, InlineField, InlineFieldRow } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

import { PanelOptions } from '../models.gen';
import { useObservable } from 'react-use';
import { Subject } from 'rxjs';
import { CanvasEditorOptions } from './elementEditor';
import { Anchor, Placement } from 'app/features/canvas';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';

const anchors: Array<keyof Anchor> = ['top', 'left', 'bottom', 'right'];
const places: Array<keyof Placement> = ['top', 'left', 'bottom', 'right', 'width', 'height'];

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
  const { placement } = element;

  return (
    <div>
      <HorizontalGroup>
        {anchors.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={element.anchor[a] ? 'primary' : 'secondary'}
            onClick={() => settings.scene.toggleAnchor(element, a)}
          >
            {a}
          </Button>
        ))}
      </HorizontalGroup>
      <br />

      <Field label="Position">
        <>
          {places.map((p) => {
            const v = placement[p];
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
