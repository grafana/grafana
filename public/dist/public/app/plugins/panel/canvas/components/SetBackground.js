import { css } from '@emotion/css';
import React, { useState } from 'react';
import { ResourceDimensionMode } from '@grafana/schema';
import { Portal, useTheme2 } from '@grafana/ui';
import { MediaType, ResourceFolderName } from 'app/features/dimensions';
import { ResourcePickerPopover } from 'app/features/dimensions/editors/ResourcePickerPopover';
export function SetBackground({ onClose, scene, anchorPoint }) {
    var _a, _b, _c;
    const defaultValue = (_c = (_b = (_a = scene.root.options.background) === null || _a === void 0 ? void 0 : _a.image) === null || _b === void 0 ? void 0 : _b.fixed) !== null && _c !== void 0 ? _c : '';
    const [bgImage, setBgImage] = useState(defaultValue);
    const theme = useTheme2();
    const styles = getStyles(theme, anchorPoint);
    const onChange = (value) => {
        if (value) {
            setBgImage(value);
            if (scene.root) {
                scene.root.options.background = Object.assign(Object.assign({}, scene.root.options.background), { image: { mode: ResourceDimensionMode.Fixed, fixed: value } });
                scene.revId++;
                scene.save();
                scene.root.reinitializeMoveable();
            }
            // Force a re-render (update scene data after config update)
            if (scene) {
                scene.updateData(scene.data);
            }
        }
        onClose();
    };
    return (React.createElement(Portal, { className: styles.portalWrapper },
        React.createElement(ResourcePickerPopover, { onChange: onChange, value: bgImage, mediaType: MediaType.Image, folderName: ResourceFolderName.IOT })));
}
const getStyles = (theme, anchorPoint) => ({
    portalWrapper: css `
    width: 315px;
    height: 445px;
    transform: translate(${anchorPoint.x}px, ${anchorPoint.y - 200}px);
  `,
});
//# sourceMappingURL=SetBackground.js.map