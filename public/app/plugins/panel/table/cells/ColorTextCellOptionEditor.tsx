import React from 'react';

import { TableColorTextCellOptions } from '@grafana/schema';
import { Field, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const ColorBackgroundCellOptionsEditor = ({
    cellOptions,
    onChange,
}: TableCellEditorProps<TableColorTextCellOptions>) => {
    // Handle row coloring changes
    const onColorRowChange = () => {
        cellOptions.applyToRow = !cellOptions.applyToRow;
        onChange(cellOptions);
    };

    return (
        <>
            <Field
                label="Apply to entire row"
                description="If selected the entire row will be colored as this cell would be."
            >
                <Switch value={cellOptions.applyToRow} onChange={onColorRowChange} />
            </Field>
        </>
    );
};
