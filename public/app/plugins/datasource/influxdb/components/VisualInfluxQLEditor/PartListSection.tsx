import { cx, css } from '@emotion/css';
import React, { useMemo } from 'react';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { MenuItem, WithContextMenu, MenuGroup, useTheme2 } from '@grafana/ui';

import { AddButton } from './AddButton';
import { Seg } from './Seg';
import { toSelectableValue } from './toSelectableValue';
import { unwrap } from './unwrap';

export type PartParams = Array<{
  value: string;
  options: (() => Promise<string[]>) | null;
}>;

type Props = {
  parts: Array<{
    name: string;
    params: PartParams;
  }>;
  getNewPartOptions: () => Promise<SelectableValue[]>;
  onChange: (partIndex: number, paramValues: string[]) => void;
  onRemovePart: (index: number) => void;
  onAddNewPart: (type: string) => void;
};

const renderRemovableNameMenuItems = (onClick: () => void) => {
  return (
    <MenuGroup label="">
      <MenuItem label="remove" onClick={onClick} />
    </MenuGroup>
  );
};

const noRightMarginPaddingClass = css({
  paddingRight: '0',
  marginRight: '0',
});

const RemovableName = ({ name, onRemove }: { name: string; onRemove: () => void }) => {
  return (
    <WithContextMenu renderMenuItems={() => renderRemovableNameMenuItems(onRemove)}>
      {({ openMenu }) => (
        <button className={cx('gf-form-label', noRightMarginPaddingClass)} onClick={openMenu}>
          {name}
        </button>
      )}
    </WithContextMenu>
  );
};

type PartProps = {
  name: string;
  params: PartParams;
  onRemove: () => void;
  onChange: (paramValues: string[]) => void;
};

const noHorizMarginPaddingClass = css({
  paddingLeft: '0',
  paddingRight: '0',
  marginLeft: '0',
  marginRight: '0',
});

const getPartClass = (theme: GrafanaTheme2) => {
  return cx(
    'gf-form-label',
    css({
      paddingLeft: '0',
      // gf-form-label class makes certain css attributes incorrect
      // for the selectbox-dropdown, so we have to "reset" them back
      lineHeight: theme.typography.body.lineHeight,
      fontSize: theme.typography.body.fontSize,
    })
  );
};

const Part = ({ name, params, onChange, onRemove }: PartProps): JSX.Element => {
  const theme = useTheme2();
  const partClass = useMemo(() => getPartClass(theme), [theme]);

  const onParamChange = (par: string, i: number) => {
    const newParams = params.map((p) => p.value);
    newParams[i] = par;
    onChange(newParams);
  };
  return (
    <div className={partClass}>
      <RemovableName name={name} onRemove={onRemove} />(
      {params.map((p, i) => {
        const { value, options } = p;
        const isLast = i === params.length - 1;
        const loadOptions =
          options !== null ? () => options().then((items) => items.map(toSelectableValue)) : undefined;
        return (
          <React.Fragment key={i}>
            <Seg
              allowCustomValue
              value={value}
              buttonClassName={noHorizMarginPaddingClass}
              loadOptions={loadOptions}
              onChange={(v) => {
                onParamChange(unwrap(v.value), i);
              }}
            />
            {!isLast && ','}
          </React.Fragment>
        );
      })}
      )
    </div>
  );
};

export const PartListSection = ({
  parts,
  getNewPartOptions,
  onAddNewPart,
  onRemovePart,
  onChange,
}: Props): JSX.Element => {
  return (
    <>
      {parts.map((part, index) => (
        <Part
          key={index}
          name={part.name}
          params={part.params}
          onRemove={() => {
            onRemovePart(index);
          }}
          onChange={(pars) => {
            onChange(index, pars);
          }}
        />
      ))}
      <AddButton loadOptions={getNewPartOptions} onAdd={onAddNewPart} />
    </>
  );
};
