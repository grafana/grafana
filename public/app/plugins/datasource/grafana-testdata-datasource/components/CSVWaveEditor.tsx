import { PureComponent, useState } from 'react';
import * as React from 'react';

import { Button, InlineField, InlineFieldRow, Input } from '@grafana/ui';

import { defaultCSVWaveQuery } from '../constants';
import type { CSVWave } from '../dataquery';

interface WavesProps {
  waves?: CSVWave[];
  onChange: (waves: CSVWave[]) => void;
}

interface WaveProps {
  wave: CSVWave;
  index: number;
  last: boolean;
  onChange: (index: number, wave?: CSVWave) => void;
  onAdd: () => void;
}

const CSVWaveEditor = (props: WaveProps) => {
  const { wave, last, index, onAdd, onChange } = props;
  const [valuesCSV, setValuesCSV] = useState(wave.valuesCSV || '');
  const [labels, setLabels] = useState(wave.labels || '');
  const [name, setName] = useState(wave.name || '');
  const onAction = () => {
    if (last) {
      onAdd();
    } else {
      onChange(index, undefined);
    }
  };
  const onValueChange = <K extends keyof CSVWave, V extends CSVWave[K]>(key: K, value: V) => {
    onChange(index, { ...wave, [key]: value });
  };
  const onKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === 'Enter') {
      onValueChange('valuesCSV', valuesCSV);
    }
  };

  return (
    <InlineFieldRow>
      <InlineField
        label={'Values'}
        grow
        tooltip="Comma separated values. Each value may be an int, float, or null and must not be empty. Whitespace and trailing commas are removed"
      >
        <Input
          value={valuesCSV}
          placeholder={'CSV values'}
          onChange={(e) => setValuesCSV(e.currentTarget.value)}
          autoFocus={true}
          onBlur={() => onValueChange('valuesCSV', valuesCSV)}
          onKeyDown={onKeyDown}
        />
      </InlineField>
      <InlineField label={'Step'} tooltip="The number of seconds between datapoints.">
        <Input
          value={wave.timeStep}
          type="number"
          placeholder={'60'}
          width={10}
          onChange={(e) => onValueChange('timeStep', e.currentTarget.valueAsNumber)}
        />
      </InlineField>
      <InlineField label={'Name'}>
        <Input
          value={name}
          placeholder={'name'}
          width={10}
          onChange={(e) => setName(e.currentTarget.value)}
          onBlur={() => onValueChange('name', name)}
        />
      </InlineField>
      <InlineField label={'Labels'}>
        <Input
          value={labels}
          placeholder={'labels'}
          width={12}
          onChange={(e) => setLabels(e.currentTarget.value)}
          onBlur={() => onValueChange('labels', labels)}
        />
      </InlineField>
      <Button
        aria-label={last ? 'Add wave' : 'Remove wave'}
        icon={last ? 'plus' : 'minus'}
        variant="secondary"
        onClick={onAction}
      />
    </InlineFieldRow>
  );
};

export class CSVWavesEditor extends PureComponent<WavesProps> {
  onChange = (index: number, wave?: CSVWave) => {
    let waves = [...(this.props.waves ?? defaultCSVWaveQuery)];
    if (wave) {
      waves[index] = { ...wave };
    } else {
      // remove the element
      waves.splice(index, 1);
    }
    this.props.onChange(waves);
  };

  onAdd = () => {
    const waves = [...(this.props.waves ?? defaultCSVWaveQuery)];
    waves.push({ ...defaultCSVWaveQuery[0] });
    this.props.onChange(waves);
  };

  render() {
    let waves = this.props.waves ?? defaultCSVWaveQuery;
    if (!waves.length) {
      waves = defaultCSVWaveQuery;
    }

    return (
      <>
        {waves.map((wave, index) => (
          <CSVWaveEditor
            key={`${index}/${wave.valuesCSV}`}
            wave={wave}
            index={index}
            onAdd={this.onAdd}
            onChange={this.onChange}
            last={index === waves.length - 1}
          />
        ))}
      </>
    );
  }
}
