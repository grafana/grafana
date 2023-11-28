import React, { useCallback } from 'react';
import { InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui/src';
import { BackgroundImageSize } from 'app/features/canvas';
const options = [
    { value: BackgroundImageSize.Original, label: 'Original' },
    { value: BackgroundImageSize.Contain, label: 'Contain' },
    { value: BackgroundImageSize.Cover, label: 'Cover' },
    { value: BackgroundImageSize.Fill, label: 'Fill' },
    { value: BackgroundImageSize.Tile, label: 'Tile' },
];
export const BackgroundSizeEditor = ({ value, onChange }) => {
    const imageSize = value !== null && value !== void 0 ? value : BackgroundImageSize.Cover;
    const onImageSizeChange = useCallback((size) => {
        onChange(size);
    }, [onChange]);
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { grow: true },
            React.createElement(RadioButtonGroup, { value: imageSize, options: options, onChange: onImageSizeChange, fullWidth: true }))));
};
//# sourceMappingURL=BackgroundSizeEditor.js.map