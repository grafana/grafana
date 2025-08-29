import { useState, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Select } from '@grafana/ui';

import { ResourceFolderName } from '../types';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const IconSelector = ({ value, onChange }: Props) => {
  const [icons, setIcons] = useState<SelectableValue[]>(value ? [{ value, label: value }] : []);
  const [icon, setIcon] = useState<string>();

  // NOTE: This value is only used to query the datasource, but not asset URLs.
  //       We should remove this when we stop relying on `-- Grafana --` for
  //       this file list, since it will not be in sync with CDN once
  //       multi-tenancy rolls out.
  // TODO: https://github.com/grafana/grafana/issues/110350
  const LEGACY_DATASOURCE_ICON_ROOT = ResourceFolderName.Icon;

  const onChangeIcon = (value: string) => {
    onChange(value);
    setIcon(value);
  };

  useEffect(() => {
    getBackendSrv()
      .get(`${LEGACY_DATASOURCE_ICON_ROOT}/index.json`)
      .then((data) => {
        setIcons(
          data.files.map((icon: string) => ({
            value: icon,
            label: icon,
          }))
        );
      });
  }, [LEGACY_DATASOURCE_ICON_ROOT]);
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
