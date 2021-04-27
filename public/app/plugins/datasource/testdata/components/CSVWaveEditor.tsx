import React, { ChangeEvent, PureComponent } from 'react';
import { Button, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { CSVWave } from '../types';
import { defaultCSVWaveQuery } from '../constants';

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

class CSVWaveEditor extends PureComponent<WaveProps> {
  onFieldChange = (field: keyof CSVWave) => (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target as HTMLInputElement;

    this.props.onChange(this.props.index, {
      ...this.props.wave,
      [field]: value,
    });
  };

  onNameChange = this.onFieldChange('name');
  onLabelsChange = this.onFieldChange('labels');
  onCSVChange = this.onFieldChange('valuesCSV');
  onTimeStepChange = (e: ChangeEvent<HTMLInputElement>) => {
    const timeStep = e.target.valueAsNumber;
    this.props.onChange(this.props.index, {
      ...this.props.wave,
      timeStep,
    });
  };

  render() {
    const { wave, last } = this.props;
    let action = this.props.onAdd;
    if (!last) {
      action = () => {
        this.props.onChange(this.props.index, undefined); // remove
      };
    }

    return (
      <InlineFieldRow>
        <InlineField
          label={'Values'}
          grow
          tooltip="Comma separated values. Each value may be an int, float, or null and must not be empty. Whitespace and trailing commas are removed"
        >
          <Input value={wave.valuesCSV} placeholder={'CSV values'} onChange={this.onCSVChange} autoFocus={true} />
        </InlineField>
        <InlineField label={'Step'} tooltip="The number of seconds between datapoints.">
          <Input value={wave.timeStep} type="number" placeholder={'60'} width={6} onChange={this.onTimeStepChange} />
        </InlineField>
        <InlineField label={'Labels'}>
          <Input value={wave.labels} placeholder={'labels'} width={12} onChange={this.onLabelsChange} />
        </InlineField>
        <InlineField label={'Name'}>
          <Input value={wave.name} placeholder={'name'} width={10} onChange={this.onNameChange} />
        </InlineField>
        <Button icon={last ? 'plus' : 'minus'} variant="secondary" onClick={action} />
      </InlineFieldRow>
    );
  }
}

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
