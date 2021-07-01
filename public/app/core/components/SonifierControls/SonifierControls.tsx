// Libraries
import React, { PureComponent, FormEvent } from 'react';
import { css } from '@emotion/css';

import { ButtonGroup, ClickOutsideWrapper, Label, Select, Slider, ToolbarButton, withTheme2 } from '@grafana/ui';

// Types
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import getSonifier from 'app/core/services/Sonifier';

export interface State {
  isOpen: boolean;
  volume: number;
  instrument: string;
  instruments: string[];
}

const GAIN_FACTOR = 0.03;

export class UnthemedSonifierControls extends PureComponent<{ theme: GrafanaTheme2 }, State> {
  state: State = {
    isOpen: false,
    volume: 0,
    instrument: '',
    instruments: [],
  };

  onChangeVolume = (value: number) => {
    const sonifier = getSonifier();
    sonifier.setVolume(value * GAIN_FACTOR);
  };

  onOpen = (event: FormEvent<HTMLButtonElement>) => {
    const { isOpen } = this.state;
    event.stopPropagation();
    event.preventDefault();
    const sonifier = getSonifier();
    const volume = sonifier.getVolume() / GAIN_FACTOR;
    const instrument = sonifier.getInstrument();
    const instruments = sonifier.getInstruments();
    this.setState({ isOpen: !isOpen, volume, instrument, instruments });
  };

  onClose = () => {
    this.setState({ isOpen: false });
  };

  onSelectInstrument = (value: SelectableValue<string>) => {
    const sonifier = getSonifier();
    sonifier.setInstrument(value.value as OscillatorType);
  };

  render() {
    const { theme } = this.props;

    const { isOpen, volume, instrument, instruments } = this.state;
    const styles = getStyles(theme);
    const instrumentOptions = instruments.map((i) => ({ label: i, value: i }));

    return (
      <ButtonGroup className={styles.container}>
        <ToolbarButton aria-label="Sonifier Controls Open Button" onClick={this.onOpen} icon="bell" isOpen={isOpen} />
        {isOpen && (
          <div className={styles.menuWrapper}>
            <ClickOutsideWrapper includeButtonPress={false} onClick={this.onClose}>
              <Label>Volume</Label>
              <Slider min={0} max={10} value={volume} onAfterChange={this.onChangeVolume} />
              <Label>Sound</Label>
              <Select value={instrument} options={instrumentOptions} onChange={this.onSelectInstrument} width={16} />
            </ClickOutsideWrapper>
          </div>
        )}
      </ButtonGroup>
    );
  }
}

/** @public */
export const SonifierControls = withTheme2(UnthemedSonifierControls);
export default SonifierControls;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      position: relative;
      display: flex;
      vertical-align: middle;
    `,
    menuWrapper: css`
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      top: ${theme.spacing(4)};
      right: 0;
      width: 240px;
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius(1)};
      padding: ${theme.spacing(2)};
    `,
  };
};
