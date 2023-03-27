import React, { useState, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Select } from '@grafana/ui';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const IconSelector = ({ value, onChange }: Props) => {
  const [icons, setIcons] = useState<SelectableValue[]>(value ? [{ value, label: value }] : []);
  const [icon, setIcon] = useState<string>();
  const iconRoot = window.__grafana_public_path__ + 'img/icons/unicons/';
  const onChangeIcon = (value: string) => {
    onChange(value);
    setIcon(value);
  };
  useEffect(() => {
    getBackendSrv()
      .get(`${iconRoot}/index.json`)
      .then((data) => {
        setIcons(
          data.files.map((icon: string) => ({
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
