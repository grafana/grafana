import React from 'react';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';
import { Switch } from '../Switch/Switch';
import capitalize from 'lodash/capitalize';
import without from 'lodash/without';
import { StatID } from '../../types/stats';

export interface LegendBasicOptions {
  isVisible: boolean;
  asTable: boolean;
  hideEmpty?: boolean;
  hideZero?: boolean;
}

export interface LegendPlacementOptions {
  placement: 'under' | 'right' | 'over'; // up to panel to implement the actual placement
}

export interface LegendOptions extends LegendBasicOptions, LegendPlacementOptions {
  stats?: StatID[];
  decimals?: number;
}

interface LegendEditorProps {
  stats: StatID[];
  options: LegendOptions;
  onChange: (options: LegendOptions) => void;
}

export const LegendEditor: React.FunctionComponent<LegendEditorProps> = props => {
  const { stats, options, onChange } = props;

  const onStatToggle = (stat: StatID) => (event?: React.SyntheticEvent<HTMLInputElement>) => {
    let newStats;
    if (!event) {
      return;
    }

    // @ts-ignore
    if (event.target.checked) {
      newStats = (options.stats || []).concat([stat]);
    } else {
      newStats = without(options.stats, stat);
    }
    onChange({
      ...options,
      stats: newStats,
    });
  };

  const onOptionToggle = (option: keyof LegendBasicOptions) => (event?: React.SyntheticEvent<HTMLInputElement>) => {
    const newOption = {};
    if (!event) {
      return;
    }
    // @ts-ignore
    newOption[option] = event.target.checked;
    onChange({
      ...options,
      ...newOption,
    });
  };

  return (
    <PanelOptionsGroup title="Legend">
      <>
        <h4>Legend options</h4>
        <Switch label="Show legend" checked={options.isVisible} onChange={onOptionToggle('isVisible')} />
        <Switch label="Display as table" checked={options.asTable} onChange={onOptionToggle('asTable')} />
      </>

      <>
        <h4>Values</h4>
        {stats.map(stat => {
          return (
            <Switch label={capitalize(stat)} checked={!!options.stats && options.stats.indexOf(stat) > -1} onChange={onStatToggle(stat)} />
          );
        })}
        <h4>Decimals</h4>
        <input
          className="gf-form-input width-5"
          type="number"
          value={options.decimals}
          onChange={event => {
            onChange({
              ...options,
              decimals: parseInt(event.target.value, 10),
            });
          }}
        />
      </>

      <>
        {options.hideEmpty !== undefined && options.hideEmpty !== undefined && (
          <>
            <h4>Legend series visibility</h4>
            {options.hideEmpty !== undefined && (
              <Switch label="With only nulls" checked={options.hideEmpty} onChange={onOptionToggle('hideEmpty')} />
            )}
            {options.hideZero !== undefined && (
              <Switch label="With only zeros" checked={options.hideZero} onChange={onOptionToggle('hideZero')} />
            )}
          </>
        )}
      </>
    </PanelOptionsGroup>
  );
};
