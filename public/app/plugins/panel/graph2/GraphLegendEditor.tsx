import React from 'react';
import capitalize from 'lodash/capitalize';
import without from 'lodash/without';
import { StatID, LegendOptions, PanelOptionsGroup, Switch, Input } from '@grafana/ui';

export interface GraphLegendEditorLegendOptions extends LegendOptions {
  stats?: StatID[];
  decimals?: number;
  sortBy?: string;
  sortDesc?: boolean;
}

interface GraphLegendEditorProps {
  stats: StatID[];
  options: GraphLegendEditorLegendOptions;
  onChange: (options: GraphLegendEditorLegendOptions) => void;
}

export const GraphLegendEditor: React.FunctionComponent<GraphLegendEditorProps> = props => {
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

  const onOptionToggle = (option: keyof LegendOptions) => (event?: React.SyntheticEvent<HTMLInputElement>) => {
    const newOption = {};
    if (!event) {
      return;
    }
    // TODO: fix the ignores
    // @ts-ignore
    newOption[option] = event.target.checked;
    if (option === 'placement') {
      // @ts-ignore
      newOption[option] = event.target.checked ? 'right' : 'under';
    }

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
        <Switch label="To the right" checked={options.placement === 'right'} onChange={onOptionToggle('placement')} />
      </>

      <>
        <h4>Values</h4>
        {stats.map(stat => {
          return (
            <Switch
              label={capitalize(stat)}
              checked={!!options.stats && options.stats.indexOf(stat) > -1}
              onChange={onStatToggle(stat)}
              key={stat}
            />
          );
        })}
        <h4>Decimals</h4>
        <Input
          className="gf-form-input width-5"
          type="number"
          value={options.decimals}
          placeholder="Auto"
          onChange={event => {
            onChange({
              ...options,
              decimals: parseInt(event.target.value, 10),
            });
          }}
        />
      </>
      <>
        <h4>Legend series visibility</h4>
        {/* <Switch label="With only nulls" checked={!!options.hideEmpty} onChange={onOptionToggle('hideEmpty')} /> */}
        <Switch label="With only zeros" checked={!!options.hideZero} onChange={onOptionToggle('hideZero')} />
      </>
    </PanelOptionsGroup>
  );
};
