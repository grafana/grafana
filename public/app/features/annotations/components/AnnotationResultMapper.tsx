import React, { PureComponent } from 'react';

import {
  DataFrame,
  SelectableValue,
  getFieldDisplayName,
  AnnotationEvent,
  formattedValueToString,
  getValueFormat,
} from '@grafana/data';

import { AnnotationsFromFrameOptions, AnnotationEventNames } from '../utils/annotationsFromDataFrame';
import { Select } from '@grafana/ui';

interface Props {
  frame?: DataFrame;

  events?: AnnotationEvent[];

  options: AnnotationsFromFrameOptions;

  // The default behavior (placeholder)
  defaults?: AnnotationsFromFrameOptions;

  change: (options: AnnotationsFromFrameOptions) => void;
}

const REMOVE_KEY = '-- Remove field mapping --';

const names: Array<keyof AnnotationEventNames> = [
  'time',
  'timeEnd',
  'title',
  'text',
  'tags',

  'userId',
  'login',
  'email',
  'avatarUrl',
];

interface State {
  fieldNames: Array<SelectableValue<string>>;
}

export class AnnotationFieldMapper extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      fieldNames: [],
    };
  }

  updateFields = () => {
    const { frame } = this.props;

    if (frame && frame.fields) {
      const fieldNames = frame.fields.map(f => {
        const name = getFieldDisplayName(f, frame);

        let description = '';
        for (let i = 0; i < frame.length; i++) {
          if (i > 0) {
            description += ', ';
          }
          if (i > 2) {
            description += '...';
            break;
          }
          description += f.values.get(i);
        }

        if (description.length > 50) {
          description = description.substring(0, 50) + '...';
        }

        return {
          label: `${name} (${f.type})`,
          value: name,
          description,
        };
      });
      this.setState({ fieldNames });
    }
  };

  componentDidMount() {
    this.updateFields();
  }

  componentDidUpdate(oldProps: Props) {
    if (oldProps.frame !== this.props.frame) {
      this.updateFields();
    }
  }

  onFieldNameChange = (k: keyof AnnotationEventNames, v: SelectableValue<string>) => {
    const options = this.props.options || {};
    const field = { ...options.field } as AnnotationEventNames;
    if (v.value === REMOVE_KEY) {
      delete field[k];
    } else {
      field[k] = v.value;
    }

    console.log('UPDATE Field mapping', field);

    this.props.change({
      ...options,
      field,
    });
  };

  renderRow(k: keyof AnnotationEventNames) {
    const { defaults, options, events } = this.props;
    const { fieldNames } = this.state;

    let defaultField = defaults?.field?.[k];
    if (!defaultField) {
      if (k === 'time') {
        defaultField = `${k} or first time field`;
      } else if (k === 'text') {
        defaultField = `${k} or first string field`;
      } else {
        defaultField = k;
      }
    }

    let picker = fieldNames;
    const current = options?.field?.[k];
    let currentValue = fieldNames.find(f => current === f.value);
    if (current) {
      picker = [
        {
          label: REMOVE_KEY,
          value: REMOVE_KEY,
          description: 'Remove the current field settings',
        },
        ...fieldNames,
      ];
      if (!currentValue) {
        picker.push({
          label: current,
          value: current,
        });
      }
    }

    let value = events?.length ? events[0][k] : '';
    if (value && k.startsWith('time')) {
      const fmt = getValueFormat('dateTimeAsIso');
      value = formattedValueToString(fmt(value as number));
    }
    if (value === null || value === undefined) {
      value = ''; // empty string
    }

    return (
      <tr key={k}>
        <td>{k}</td>
        <td>
          <Select
            value={
              currentValue || {
                label: `default: ${defaultField}`,
              }
            }
            options={picker}
            placeholder={defaultField} // not used because we always force a value so remove is not managed
            onChange={(v: SelectableValue<string>) => {
              this.onFieldNameChange(k, v);
            }}
            noOptionsMessage="Unknown field names"
            allowCustomValue={true}
          />
        </td>
        <td>{`${value}`}</td>
      </tr>
    );
  }

  render() {
    return (
      <table className="filter-table">
        <thead>
          <tr>
            <th>Annotation</th>
            <th>Use result field:</th>
            <th>First Value</th>
          </tr>
        </thead>
        <tbody>
          {names.map(k => {
            return this.renderRow(k);
          })}
        </tbody>
      </table>
    );
  }
}
