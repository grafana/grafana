import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/schema';
import { HorizontalGroup, Select } from '@grafana/ui';

const barGaugeOpts: SelectableValue[] = [
    { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
    { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
    { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' }
]

export const BarGaugeCellOptions: React.FC = (props) => {

    const onChange = () => {

    }

    return (
        <HorizontalGroup>
            <Select
                onChange={onChange}
                options={barGaugeOpts}
            />
        </HorizontalGroup>
    );
}
