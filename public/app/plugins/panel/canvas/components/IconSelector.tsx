import React, { useState, useEffect } from 'react';
import { Select } from '@grafana/ui';
import { StandardEditorProps } from '../../../../../../packages/grafana-data/src';
import { Settings } from 'app/core/config';

interface Icon {
  value: string;
  label: string;
}
const IconSelector: React.FC<StandardEditorProps<string, Settings>> = ({ onChange }) => {
  const [icons, setIcons] = useState([]);
  const [icon, setIcon] = useState<string>();
  const iconRoot = (window as any).__grafana_public_path__ + 'img/icons/unicons/';
  const onChangeIcon = (value: string) => {
    onChange(value);
    setIcon(value);
  };
  useEffect(() => {
    fetch(`${iconRoot}/index.json`)
      .then((data) => data.json())
      .then((data) => {
        setIcons(
          data.files.map((icon: Icon) => ({
            value: icon,
            label: icon,
          }))
        );
      });
  }, [iconRoot]);
  return (
    <Select
      options={icons}
      value={icon}
      onChange={(selectedValue) => {
        onChangeIcon(selectedValue.value!);
      }}
    />
  );
};

export default IconSelector;
