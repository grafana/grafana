import React from 'react';

import { TagsInput, InlineField } from '@grafana/ui';

import { PanelModel } from '../../state';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionPaneRenderProps } from './types';

export function getExemplarPanelOptionsCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelOptionsChanged } = props;
  const setExemplarLabels = (ls: PanelModel['options']) => {
    let options = panel.options;
    options['exemplars'] = ls;
    onPanelOptionsChanged(options);
  };

  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Exemplar Configuration',
    id: 'Exemplar Configuration',
    isOpenDefault: true,
  });

  descriptor.addItem(
    new OptionsPaneItemDescriptor({
      title: '',
      value: '',
      popularRank: 1,
      render: function renderName() {
        return (
          <InlineField
            label="Labels"
            tooltip="Add exemplar labels to be displayed on exemplar tooltip. Note that the order of labels added is also important and the same order is displayed on the exemplar tooltip"
          >
            <TagsInput
              placeholder="trace_id"
              tags={panel.options?.exemplars}
              onChange={(ls) => setExemplarLabels(ls)}
            />
          </InlineField>
        );
      },
    })
  );

  return descriptor;
}
