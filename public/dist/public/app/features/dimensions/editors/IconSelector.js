import React, { useState, useEffect } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Select } from '@grafana/ui';
const IconSelector = ({ value, onChange }) => {
    const [icons, setIcons] = useState(value ? [{ value, label: value }] : []);
    const [icon, setIcon] = useState();
    const iconRoot = window.__grafana_public_path__ + 'img/icons/unicons/';
    const onChangeIcon = (value) => {
        onChange(value);
        setIcon(value);
    };
    useEffect(() => {
        getBackendSrv()
            .get(`${iconRoot}/index.json`)
            .then((data) => {
            setIcons(data.files.map((icon) => ({
                value: icon,
                label: icon,
            })));
        });
    }, [iconRoot]);
    return (React.createElement(Select, { options: icons, value: icon, onChange: (selectedValue) => {
            onChangeIcon(selectedValue.value);
        } }));
};
export default IconSelector;
//# sourceMappingURL=IconSelector.js.map