import { useCallback } from 'react';

import {
    DataTransformerID,
    SelectableValue,
    standardTransformers,
    TransformerRegistryItem,
    TransformerUIProps,
    TransformerCategory,
} from '@grafana/data';
import { IgnoreRowTransformerOptions } from '@grafana/data/src/transformations/transformers/ignoreRow';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, RadioButtonGroup } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';

const positionOptions: Array<SelectableValue<'first' | 'last'>> = [
    {
        label: 'Oldest sample',
        value: 'first',
        description: 'Ignore the oldest sample of each series',
    },
    {
        label: 'Newest sample',
        value: 'last',
        description: 'Ignore the newest sample of each series',
    },
];

export const IgnoreRowTransformerEditor = ({
    input,
    options,
    onChange,
}: TransformerUIProps<IgnoreRowTransformerOptions>) => {
    const onSelectPosition = useCallback(
        (value: 'first' | 'last') => {
            onChange({
                ...options,
                position: value,
            });
        },
        [onChange, options]
    );

    return (
        <div data-testid={selectors.components.TransformTab.transformationEditor('Ignore Row')}>
            <InlineField label="Position" labelWidth={12} grow>
                <RadioButtonGroup
                    options={positionOptions}
                    value={options.position || 'first'}
                    onChange={onSelectPosition}
                />
            </InlineField>
        </div>
    );
};

export const ignoreRowTransformerRegistryItem: TransformerRegistryItem<IgnoreRowTransformerOptions> = {
    id: DataTransformerID.ignoreRow,
    editor: IgnoreRowTransformerEditor,
    transformation: standardTransformers.ignoreRowTransformer,
    name: standardTransformers.ignoreRowTransformer.name,
    description: 'Ignore the oldest or newest sample of each series',
    categories: new Set([TransformerCategory.Filter]),
    help: getTransformationContent(DataTransformerID.ignoreRow).helperDocs,
};
