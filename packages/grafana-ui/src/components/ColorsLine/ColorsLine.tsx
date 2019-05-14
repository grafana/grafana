import React, { PureComponent } from 'react';
import { ColorPicker } from '..';
import { colors } from '@grafana/ui';
import { Tooltip } from '../Tooltip/Tooltip';

export type ColorsDef = {
  colors: string[];
  editable: boolean;
  source: string;
};

export interface Props {
  label: string;
  tooltip?: string;
  editable: boolean;
  transparent?: boolean;
  defaultColorsProvider: (editable: boolean) => ColorsDef;
  updateColorsDelegate: (colors: string[]) => void;
}

export class ColorsLine extends PureComponent<Props> {
  state = {
    colorsDef: this.getDefaultColorsPalette(),
  };

  private getDefaultColorsPalette() {
    return this.props.defaultColorsProvider(!this.props.editable);
  }

  private resetDefaultColors() {
    this.state.colorsDef = this.props.defaultColorsProvider(!this.props.editable);
  }

  changeColorAt(index: number, color: string) {
    this.state.colorsDef.colors[index] = color;
    this.setState({ style: { backgroundColor: color } });
    this.updateChanges();
  }

  addColorAt(index: number, color: string) {
    this.state.colorsDef.colors.splice(++index, 0, color);
    this.setState({ value: [index, color] });
    this.updateChanges();
  }

  removeColorAt(index: number) {
    this.state.colorsDef.colors.splice(index, 1);
    this.setState({ value: [index, 'r'] });
    this.updateChanges();
  }

  updateChanges = () => {
    this.props.updateColorsDelegate(this.state.colorsDef.colors);
  };

  colorHandler(event: React.MouseEvent, index: number, action: Function) {
    event.preventDefault();
    if (this.props.editable) {
      if (event.ctrlKey || event.button === 1) {
        this.removeColorAt(index);
      } else if (event.altKey) {
        //TODO: popup text editor comma separated colors
      } else {
        action();
      }
    }
  }

  render() {
    this.resetDefaultColors();
    const { editable, label, tooltip } = this.props;
    const currentColors = this.state.colorsDef.colors;
    const colorsElements =
      currentColors.length > 0 ? (
        currentColors.map((clr, ind) => [
          <ColorPicker
            color={clr}
            key={'c' + ind}
            onChange={color => {
              this.changeColorAt(ind, color);
            }}
          >
            {({ ref, showColorPicker, hideColorPicker }) => (
              <a
                href="#"
                ref={ref}
                onClick={event => this.colorHandler(event, ind, showColorPicker)}
                onMouseLeave={editable ? hideColorPicker : () => {}}
                style={{ backgroundColor: clr }}
              />
            )}
          </ColorPicker>,
          <button
            key={'a' + ind}
            onClick={() => this.addColorAt(ind, colors[Math.floor(Math.random() * colors.length)])}
            style={{ display: !editable ? 'none' : 'block' }}
          >
            +
          </button>,
        ])
      ) : (
        <button
          key="a-1"
          onClick={() => this.addColorAt(currentColors.length - 1, colors[Math.floor(Math.random() * colors.length)])}
          ng-show={{ display: !editable ? 'none' : 'block' }}
        >
          +
        </button>
      );

    return (
      <div className="gf-form max-width">
        <label className="gf-form-label width-15">
          {label} ({this.state.colorsDef.source})
          {editable && tooltip && (
            <Tooltip content={tooltip as string}>
              <i className="grafana-tip fa fa-info-circle" style={{ cursor: 'pointer' }} />
            </Tooltip>
          )}
        </label>
        <div className="gf-form-colorsline-container gf-form-input">{colorsElements}</div>
      </div>
    );
  }
}
