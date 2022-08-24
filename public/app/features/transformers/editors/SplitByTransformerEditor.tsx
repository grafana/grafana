import React, { useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  PluginState,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { SplitByTransformerOptions } from '@grafana/data/src/transformations/transformers/splitBy';
import { FieldValidationMessage, InlineField } from '@grafana/ui';

import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24 },
} as any;

export const SplitByTransformerEditor: React.FC<TransformerUIProps<SplitByTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const onSelectField = useCallback(
    (value: string | undefined) => {
      onChange({
        ...options,
        field: value ?? '',
      });
    },
    [onChange, options]
  );

  if (input.length > 1) {
    return (
      <FieldValidationMessage>
        Split by only works with a single frame.
      </FieldValidationMessage>
    );
  }

  return (
    <InlineField label={'Field'}>
        <FieldNamePicker
        context={{ data: input }}
        value={options.field}
        onChange={onSelectField}
        item={fieldNamePickerSettings}
        />
    </InlineField>
  );
};

export const splitByTransformRegistryItem: TransformerRegistryItem<SplitByTransformerOptions> = {
  id: DataTransformerID.splitBy,
  editor: SplitByTransformerEditor,
  transformation: standardTransformers.splitByTransformer,
  name: standardTransformers.splitByTransformer.name,
  description: standardTransformers.splitByTransformer.description,
  state: PluginState.alpha,
  help: `
### Use cases

This transforms one frame into many frames by grouping rows on each unique value of a given field.
This is similar to the 'Group by' transform, but instead of calculating aggregates for each group,
it splits apart the rows into separate frames. This can be useful for labeling or coloring parts of
a timeseries.

## Example

Input:

| Time | Value | Group  |
|------|-------|--------|
| 1    | 10    | Dog    |
| 2    | 20    | Dog    |
| 3    | 30    | Cat    |
| 4    | 40    | Cat    |
| 5    | 30    | Rabbit |

Output:

Series 1: 'Dog'
| Time | Value |
|------|-------|
| 1    | 10    |
| 2    | 20    |

Series 2: 'Cat'
| Time | Value |
|------|-------|
| 3    | 30    |
| 4    | 40    |

Series 3: 'Rabbit'
| Time | Value |
|------|-------|
| 5    | 30    |

There's three unique values for the 'Group' column, so this example data produces three separate frames.
`,
};
