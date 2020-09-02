import React, { PureComponent } from 'react';

import { DataFrame, SelectableValue, getFieldDisplayName } from '@grafana/data';
import { css } from 'emotion';

import { AnnotationsFromFrameOptions, AnnotationEventNames } from '../utils/annotationsFromDataFrame';
import { Select } from '@grafana/ui';

interface Props {
  data?: DataFrame;

  options: AnnotationsFromFrameOptions;

  // The default behavior (placeholder)
  defaults?: AnnotationsFromFrameOptions;

  // Any value will be hidden
  hide?: AnnotationsFromFrameOptions;

  change: (options: AnnotationsFromFrameOptions) => void;
}

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
  firstValues?: Record<keyof AnnotationEventNames, string>;
}

export class AnnotationFieldMapper extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      fieldNames: [],
    };
  }

  updateFields = () => {
    const { data } = this.props;
    if (data && data.fields) {
      const fieldNames = data.fields.map(f => {
        const name = getFieldDisplayName(f, data);

        let description = '';
        for (let i = 0; i < 3 && i < data.length; i++) {
          description += f.values.get(i) + ', ';
        }
        description += '...';
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
    if (oldProps.data !== this.props.data) {
      this.updateFields();
    }
  }

  onFieldNameChange = (k: keyof AnnotationEventNames, v: SelectableValue<string>) => {
    console.log('TODO.....', k, v);
  };

  renderRow(k: keyof AnnotationEventNames) {
    const { defaults, hide, options } = this.props;
    if (hide?.field?.[k]) {
      return null; // nothing
    }
    const { fieldNames, firstValues } = this.state;

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
    if (current && !currentValue) {
      picker = [
        {
          label: current,
          value: current,
        },
        ...fieldNames,
      ];
    }

    return (
      <tr key={k}>
        <td>{k}</td>
        <td>
          <Select
            value={currentValue}
            options={picker}
            placeholder={defaultField}
            onChange={(v: SelectableValue<string>) => {
              this.onFieldNameChange(k, v);
            }}
            allowCustomValue={true}
          />
        </td>
        {firstValues && <td>{firstValues[k]}</td>}
      </tr>
    );
  }

  render() {
    const { firstValues } = this.state;

    return (
      <>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th
                className={css`
                  min-width: 200px;
                `}
              >
                Name
              </th>
              {firstValues && <th>Values</th>}
            </tr>
          </thead>
          <tbody>
            {names.map(k => {
              return this.renderRow(k);
            })}
          </tbody>
        </table>
        <br />
        <br />
      </>
    );
  }
}
